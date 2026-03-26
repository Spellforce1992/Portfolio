/*
 * grid_solver.c — WASM SWAR solver for cyclic grid puzzle
 *
 * Board packed into uint64 words using SWAR encoding:
 *   N=2: 1 bit/cell  (64 cells/word, XOR ops)
 *   N=3: 2 bits/cell  (32 cells/word, XOR-flip logic)
 *   N=4: 2 bits/cell  (32 cells/word, bit-plane carry/borrow)
 *   N=5: 4 bits/cell  (16 cells/word, nibble add+correct)
 *
 * Compile: emcc -O3 -flto -msimd128 --no-entry \
 *          -s INITIAL_MEMORY=4194304 -o grid_solver.wasm grid_solver.c
 */

#include <stdint.h>
#include <string.h>

/* ── Limits ── */
#define MAX_CELLS    256
#define MAX_PIECES   64
#define MAX_WORDS    14       /* max uint64 board words */
#define MAX_OFFS     2048
#define MAX_TOTAL_POS 16384   /* total positions across all pieces */

/* ── Puzzle config (set by JS) ── */
static int g_rows, g_cols, g_sz, g_N, g_goal, g_n_pieces;
static int g_nwords;   /* actual uint64 words for this puzzle */
static int g_bpc;      /* bits per cell */
static int g_cpc;      /* cells per uint64 */

/* ── Raw board (set by JS) ── */
static uint8_t raw_board[MAX_CELLS];

/* ── Piece data (set by JS, flat packed) ── */
static int16_t  all_offsets[MAX_OFFS];
static uint32_t off_start[MAX_PIECES];
static uint8_t  off_count[MAX_PIECES];

static int16_t  all_positions[MAX_TOTAL_POS];
static uint32_t pos_start[MAX_PIECES];
static uint16_t pos_count[MAX_PIECES];

static uint16_t orig_idx[MAX_PIECES];
static uint8_t  same_as_prev[MAX_PIECES];

/* Corner data (for corner pruning) */
static uint8_t  all_corner_masks[MAX_TOTAL_POS];
static uint16_t rem_surface[MAX_PIECES + 1];
static uint16_t corner_rem[4 * (MAX_PIECES + 1)];
static uint8_t  corner_needed[4];

/* ── SWAR packed data (computed by prepare()) ── */
static uint64_t board_packed[MAX_WORDS];
static uint64_t board_init_packed[MAX_WORDS];
static uint64_t target_packed[MAX_WORDS];

/* Packed masks: mask for piece pi, position vi =
   all_masks + (mask_cumpos[pi] + vi) * g_nwords */
static uint64_t all_masks[MAX_TOTAL_POS * MAX_WORDS];
static uint32_t mask_cumpos[MAX_PIECES];

/* Reachability: suffix-OR of piece position masks */
static uint64_t reach[MAX_PIECES + 1][MAX_WORDS];

/* ── Solve state ── */
static int      cur_pi;
static int32_t  cur_vi[MAX_PIECES];
static int      req_change;
static uint8_t  corner_deficit[4];
static int      saved_delta[MAX_PIECES];
static uint8_t  saved_cmask[MAX_PIECES];
static int      solve_start, solve_end;
static int      is_prepared;

/* ── Results ── */
static int16_t  result_placements[MAX_PIECES];
static uint64_t nodes_explored;
static uint64_t surface_skipped;
static uint64_t corner_skipped;
static uint64_t reach_skipped;

/* ═══════════════════════════════════════════════════════
 *  SWAR helpers
 * ═══════════════════════════════════════════════════════ */

#define ONES_2BIT  0x5555555555555555ULL
#define ONES_4BIT  0x1111111111111111ULL
#define VALUE_4BIT 0x7777777777777777ULL

/* Pack a single cell value into a word array */
static inline void pack_cell(uint64_t *words, int cell, uint8_t val) {
    int w = cell / g_cpc;
    int pos = cell % g_cpc;
    words[w] |= ((uint64_t)val) << (pos * g_bpc);
}

/* Check board == target */
static inline int swar_is_solved(const uint64_t *board, const uint64_t *target, int nw) {
    for (int w = 0; w < nw; w++)
        if (board[w] != target[w]) return 0;
    return 1;
}

/* ── N=2: XOR (1 bit/cell) ── */

static inline void swar_place_2(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) board[w] ^= mask[w];
}
/* undo = place for XOR */
#define swar_undo_2 swar_place_2

static inline int swar_unreachable_2(const uint64_t *board, const uint64_t *target,
                                      const uint64_t *rch, int nw) {
    for (int w = 0; w < nw; w++)
        if ((board[w] ^ target[w]) & ~rch[w]) return 1;
    return 0;
}
static inline int count_needed_2(const uint64_t *board, const uint64_t *target, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++) c += __builtin_popcountll(board[w] ^ target[w]);
    return c;
}

/* ── N=3: XOR-flip (2 bits/cell) ── */

static inline void swar_place_3(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        uint64_t even = b & ONES_2BIT;
        uint64_t odd  = (b >> 1) & ONES_2BIT;
        /* inc mod 3: 00→01, 01→10, 10→00 */
        uint64_t f0 = ~odd & m;              /* flip bit0 when bit1=0 */
        uint64_t f1 = (even ^ odd) & m;      /* flip bit1 when bits differ */
        board[w] = (even ^ f0) | ((odd ^ f1) << 1);
    }
}
static inline void swar_undo_3(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        uint64_t even = b & ONES_2BIT;
        uint64_t odd  = (b >> 1) & ONES_2BIT;
        /* dec mod 3: 00→10, 01→00, 10→01 */
        uint64_t f0 = (even | odd) & m;      /* flip bit0 when value!=0 */
        uint64_t f1 = ~even & m;             /* flip bit1 when bit0=0 */
        board[w] = (even ^ f0) | ((odd ^ f1) << 1);
    }
}
static inline int swar_unreachable_23(const uint64_t *board, const uint64_t *target,
                                       const uint64_t *rch, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t ng = (d & ONES_2BIT) | ((d >> 1) & ONES_2BIT);
        if (ng & ~rch[w]) return 1;
    }
    return 0;
}
static inline int count_needed_23(const uint64_t *board, const uint64_t *target, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t ng = (d & ONES_2BIT) | ((d >> 1) & ONES_2BIT);
        c += __builtin_popcountll(ng);
    }
    return c;
}

/* ── N=4: bit-plane carry/borrow (2 bits/cell) ── */

static inline void swar_place_4(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        uint64_t even = b & ONES_2BIT;
        uint64_t odd  = (b >> 1) & ONES_2BIT;
        uint64_t ne = even ^ m;           /* flip bit0 */
        uint64_t carry = even & m;        /* carry into bit1 */
        board[w] = ne | ((odd ^ carry) << 1);
    }
}
static inline void swar_undo_4(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        uint64_t even = b & ONES_2BIT;
        uint64_t odd  = (b >> 1) & ONES_2BIT;
        uint64_t ne = even ^ m;           /* flip bit0 */
        uint64_t borrow = ~even & m;      /* borrow when bit0 was 0 */
        board[w] = ne | ((odd ^ borrow) << 1);
    }
}
/* unreachable and count_needed same as N=3 (2-bit cells) */

/* ── N=5: nibble add+correct (4 bits/cell) ── */

static inline void swar_place_5(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        /* detect cells at value 4 (0100) that are covered */
        uint64_t b0 = b & ONES_4BIT;
        uint64_t b1 = (b >> 1) & ONES_4BIT;
        uint64_t b2 = (b >> 2) & ONES_4BIT;
        uint64_t at4 = b2 & ~b1 & ~b0 & m;
        uint64_t s = b + m;                        /* +1 to covered cells */
        s -= at4 | (at4 << 2);                     /* cells at 4→5, subtract 5 → 0 */
        board[w] = s & VALUE_4BIT;
    }
}
static inline void swar_undo_5(uint64_t *board, const uint64_t *mask, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t b = board[w], m = mask[w];
        /* detect cells at value 0 that are covered (will underflow) */
        uint64_t b0 = b & ONES_4BIT;
        uint64_t b1 = (b >> 1) & ONES_4BIT;
        uint64_t b2 = (b >> 2) & ONES_4BIT;
        uint64_t at0 = ~b0 & ~b1 & ~b2 & m & ONES_4BIT;
        uint64_t pre = at0 | (at0 << 2);           /* pre-add 5 to zero cells */
        uint64_t s = b + pre;
        s -= m;                                     /* subtract 1 from covered */
        board[w] = s & VALUE_4BIT;
    }
}
static inline int swar_unreachable_5(const uint64_t *board, const uint64_t *target,
                                      const uint64_t *rch, int nw) {
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t ng = (d & ONES_4BIT) | ((d >> 1) & ONES_4BIT) | ((d >> 2) & ONES_4BIT);
        if (ng & ~rch[w]) return 1;
    }
    return 0;
}
static inline int count_needed_5(const uint64_t *board, const uint64_t *target, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t ng = (d & ONES_4BIT) | ((d >> 1) & ONES_4BIT) | ((d >> 2) & ONES_4BIT);
        c += __builtin_popcountll(ng);
    }
    return c;
}

/* ═══════════════════════════════════════════════════════
 *  Exported init functions (called from JS)
 * ═══════════════════════════════════════════════════════ */

__attribute__((export_name("init")))
void init(int rows, int cols, int num_states, int goal, int num_pieces) {
    g_rows = rows; g_cols = cols; g_sz = rows * cols;
    g_N = num_states; g_goal = goal; g_n_pieces = num_pieces;
    is_prepared = 0;
    memset(raw_board, 0, sizeof(raw_board));
    memset(off_count, 0, sizeof(off_count));
    memset(pos_count, 0, sizeof(pos_count));
    memset(same_as_prev, 0, sizeof(same_as_prev));
}

__attribute__((export_name("set_board")))
void set_board(int idx, uint8_t val) { raw_board[idx] = val; }

__attribute__((export_name("set_piece")))
void set_piece(int pi, int n_offs, int n_pos, int o_start, int p_start, uint16_t oi) {
    off_count[pi] = (uint8_t)n_offs;
    pos_count[pi] = (uint16_t)n_pos;
    off_start[pi] = (uint32_t)o_start;
    pos_start[pi] = (uint32_t)p_start;
    orig_idx[pi] = oi;
}

__attribute__((export_name("set_offset")))
void set_offset(int idx, int16_t val) { all_offsets[idx] = val; }

__attribute__((export_name("set_position")))
void set_position(int idx, int16_t val) { all_positions[idx] = val; }

__attribute__((export_name("set_corner_mask")))
void set_corner_mask(int idx, uint8_t mask) { all_corner_masks[idx] = mask; }

__attribute__((export_name("set_rem_surface")))
void set_rem_surface(int idx, uint16_t val) { rem_surface[idx] = val; }

__attribute__((export_name("set_corner_rem")))
void set_corner_rem(int ci, int pi, uint16_t val) {
    corner_rem[ci * (g_n_pieces + 1) + pi] = val;
}

__attribute__((export_name("set_corner_needed")))
void set_corner_needed(int ci, uint8_t val) { corner_needed[ci] = val; }

__attribute__((export_name("set_same_as_prev")))
void set_same_as_prev(int pi, uint8_t val) { same_as_prev[pi] = val; }

/* ═══════════════════════════════════════════════════════
 *  prepare() — pack SWAR data, precompute masks & reachability
 * ═══════════════════════════════════════════════════════ */

__attribute__((export_name("prepare")))
void prepare(void) {
    /* Determine encoding */
    switch (g_N) {
        case 2: g_bpc = 1; g_cpc = 64; break;
        case 3: g_bpc = 2; g_cpc = 32; break;
        case 4: g_bpc = 2; g_cpc = 32; break;
        default: g_bpc = 4; g_cpc = 16; break; /* N=5 */
    }
    g_nwords = (g_sz + g_cpc - 1) / g_cpc;

    /* Pack initial board */
    memset(board_init_packed, 0, sizeof(board_init_packed));
    for (int i = 0; i < g_sz; i++)
        pack_cell(board_init_packed, i, raw_board[i]);

    /* Pack target (all cells = goal) */
    memset(target_packed, 0, sizeof(target_packed));
    for (int i = 0; i < g_sz; i++)
        pack_cell(target_packed, i, (uint8_t)g_goal);

    /* Compute cumulative position offsets */
    mask_cumpos[0] = 0;
    for (int pi = 1; pi < g_n_pieces; pi++)
        mask_cumpos[pi] = mask_cumpos[pi - 1] + pos_count[pi - 1];

    /* Generate packed masks for every piece/position */
    uint64_t piece_reach[MAX_PIECES][MAX_WORDS];
    memset(piece_reach, 0, sizeof(piece_reach));

    for (int pi = 0; pi < g_n_pieces; pi++) {
        for (int vi = 0; vi < pos_count[pi]; vi++) {
            uint64_t *mask = all_masks + (mask_cumpos[pi] + vi) * g_nwords;
            memset(mask, 0, g_nwords * sizeof(uint64_t));
            int base = all_positions[pos_start[pi] + vi];
            for (int k = 0; k < off_count[pi]; k++) {
                int cell = base + all_offsets[off_start[pi] + k];
                pack_cell(mask, cell, 1);
            }
            /* Accumulate per-piece reachability */
            for (int w = 0; w < g_nwords; w++)
                piece_reach[pi][w] |= mask[w];
        }
    }

    /* Compute reachability suffix-OR */
    memset(reach[g_n_pieces], 0, g_nwords * sizeof(uint64_t));
    for (int pi = g_n_pieces - 1; pi >= 0; pi--)
        for (int w = 0; w < g_nwords; w++)
            reach[pi][w] = reach[pi + 1][w] | piece_reach[pi][w];

    is_prepared = 1;
}

/* ═══════════════════════════════════════════════════════
 *  N-specialized solve loops
 * ═══════════════════════════════════════════════════════ */

static inline void save_placements(void) {
    for (int i = 0; i < g_n_pieces; i++)
        result_placements[i] = (cur_vi[i] >= 0)
            ? all_positions[pos_start[i] + cur_vi[i]] : -1;
}

/* Count covered cells at goal value using SWAR — O(nwords), no per-cell extraction */
static inline int covered_goal_1(const uint64_t *board, const uint64_t *target,
                                  const uint64_t *mask, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++)
        c += __builtin_popcountll(~(board[w] ^ target[w]) & mask[w]);
    return c;
}
static inline int covered_goal_23(const uint64_t *board, const uint64_t *target,
                                   const uint64_t *mask, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t nz = (d & ONES_2BIT) | ((d >> 1) & ONES_2BIT);
        c += __builtin_popcountll(~nz & mask[w]);
    }
    return c;
}
static inline int covered_goal_5(const uint64_t *board, const uint64_t *target,
                                  const uint64_t *mask, int nw) {
    int c = 0;
    for (int w = 0; w < nw; w++) {
        uint64_t d = board[w] ^ target[w];
        uint64_t nz = (d & ONES_4BIT) | ((d >> 1) & ONES_4BIT) | ((d >> 2) & ONES_4BIT);
        c += __builtin_popcountll(~nz & mask[w]);
    }
    return c;
}

#define GEN_SOLVE(NV, PLACE, UNDO, UNREACH, CNTNEEDED, COVGOAL)                        \
__attribute__((noinline))                                                      \
static int solve_n##NV(int max_nodes) {                                        \
    const int np = g_n_pieces;                                                 \
    const int nw = g_nwords;                                                   \
    int nodes_this = 0;                                                        \
                                                                               \
    while (cur_pi >= 0) {                                                      \
        if (nodes_this >= max_nodes) return 0;                                 \
                                                                               \
        cur_vi[cur_pi]++;                                                      \
        int max_vi = (cur_pi == 0) ? solve_end : (int)pos_count[cur_pi];       \
                                                                               \
        if (same_as_prev[cur_pi] && cur_pi > 0 &&                             \
            cur_vi[cur_pi] < cur_vi[cur_pi - 1])                              \
            cur_vi[cur_pi] = cur_vi[cur_pi - 1];                              \
                                                                               \
        if (cur_vi[cur_pi] >= max_vi) {                                        \
            cur_vi[cur_pi] = -1;                                               \
            cur_pi--;                                                          \
            if (cur_pi >= 0) {                                                 \
                uint64_t *m_ = all_masks + (mask_cumpos[cur_pi]                \
                    + cur_vi[cur_pi]) * nw;                                    \
                UNDO(board_packed, m_, nw);                                    \
                req_change -= saved_delta[cur_pi];                             \
                uint8_t cm_ = saved_cmask[cur_pi];                             \
                if (cm_) {                                                     \
                    if (cm_&1){corner_deficit[0]++;if(corner_deficit[0]==NV)corner_deficit[0]=0;}\
                    if (cm_&2){corner_deficit[1]++;if(corner_deficit[1]==NV)corner_deficit[1]=0;}\
                    if (cm_&4){corner_deficit[2]++;if(corner_deficit[2]==NV)corner_deficit[2]=0;}\
                    if (cm_&8){corner_deficit[3]++;if(corner_deficit[3]==NV)corner_deficit[3]=0;}\
                }                                                              \
            }                                                                  \
            continue;                                                          \
        }                                                                      \
                                                                               \
        /* ── Place piece ── */                                                \
        int vi = cur_vi[cur_pi];                                               \
        uint64_t *mask = all_masks + (mask_cumpos[cur_pi] + vi) * nw;          \
        int cg = COVGOAL(board_packed, target_packed, mask, nw);               \
        int delta = NV * cg - (int)off_count[cur_pi];                          \
        PLACE(board_packed, mask, nw);                                         \
        req_change += delta;                                                   \
        saved_delta[cur_pi] = delta;                                           \
                                                                               \
        uint8_t cmask = all_corner_masks[pos_start[cur_pi] + vi];              \
        saved_cmask[cur_pi] = cmask;                                           \
        if (cmask) {                                                           \
            if (cmask&1){corner_deficit[0]=corner_deficit[0]==0?(NV-1):corner_deficit[0]-1;}\
            if (cmask&2){corner_deficit[1]=corner_deficit[1]==0?(NV-1):corner_deficit[1]-1;}\
            if (cmask&4){corner_deficit[2]=corner_deficit[2]==0?(NV-1):corner_deficit[2]-1;}\
            if (cmask&8){corner_deficit[3]=corner_deficit[3]==0?(NV-1):corner_deficit[3]-1;}\
        }                                                                      \
                                                                               \
        nodes_explored++;                                                      \
        nodes_this++;                                                          \
                                                                               \
        /* ── Last piece? ── */                                                \
        if (cur_pi == np - 1) {                                                \
            if (req_change == 0 &&                                             \
                swar_is_solved(board_packed, target_packed, nw)) {              \
                save_placements();                                             \
                return 1;                                                      \
            }                                                                  \
            UNDO(board_packed, mask, nw);                                      \
            req_change -= delta;                                               \
            if (cmask) {                                                       \
                if (cmask&1){corner_deficit[0]++;if(corner_deficit[0]==NV)corner_deficit[0]=0;}\
                if (cmask&2){corner_deficit[1]++;if(corner_deficit[1]==NV)corner_deficit[1]=0;}\
                if (cmask&4){corner_deficit[2]++;if(corner_deficit[2]==NV)corner_deficit[2]=0;}\
                if (cmask&8){corner_deficit[3]++;if(corner_deficit[3]==NV)corner_deficit[3]=0;}\
            }                                                                  \
            continue;                                                          \
        }                                                                      \
                                                                               \
        int next = cur_pi + 1;                                                 \
                                                                               \
        /* ── Reachability pruning ── */                                       \
        if (UNREACH(board_packed, target_packed, reach[next], nw)) {            \
            reach_skipped++;                                                   \
            goto undo_##NV;                                                    \
        }                                                                      \
                                                                               \
        /* ── Surface pruning ── */                                            \
        if (req_change > (int)rem_surface[next]) {                             \
            surface_skipped++;                                                 \
            goto undo_##NV;                                                    \
        }                                                                      \
                                                                               \
        /* ── Corner pruning ── */                                             \
        {                                                                      \
            int pruned = 0;                                                    \
            for (int ci = 0; ci < 4; ci++) {                                   \
                if (corner_deficit[ci] > 0 &&                                  \
                    corner_deficit[ci] > corner_rem[ci*(np+1)+next]) {          \
                    pruned = 1; break;                                         \
                }                                                              \
            }                                                                  \
            if (pruned) {                                                      \
                corner_skipped++;                                              \
                goto undo_##NV;                                                \
            }                                                                  \
        }                                                                      \
                                                                               \
        /* ── Descend ── */                                                    \
        cur_pi++;                                                              \
        cur_vi[cur_pi] = -1;                                                   \
        if (same_as_prev[cur_pi] && cur_pi > 0)                               \
            cur_vi[cur_pi] = cur_vi[cur_pi - 1] - 1;                          \
        continue;                                                              \
                                                                               \
    undo_##NV:                                                                 \
        UNDO(board_packed, mask, nw);                                          \
        req_change -= delta;                                                   \
        if (cmask) {                                                           \
            if (cmask&1){corner_deficit[0]++;if(corner_deficit[0]==NV)corner_deficit[0]=0;}\
            if (cmask&2){corner_deficit[1]++;if(corner_deficit[1]==NV)corner_deficit[1]=0;}\
            if (cmask&4){corner_deficit[2]++;if(corner_deficit[2]==NV)corner_deficit[2]=0;}\
            if (cmask&8){corner_deficit[3]++;if(corner_deficit[3]==NV)corner_deficit[3]=0;}\
        }                                                                      \
    }                                                                          \
    return 2;                                                                  \
}

GEN_SOLVE(2, swar_place_2, swar_undo_2, swar_unreachable_2,  count_needed_2,  covered_goal_1)
GEN_SOLVE(3, swar_place_3, swar_undo_3, swar_unreachable_23, count_needed_23, covered_goal_23)
GEN_SOLVE(4, swar_place_4, swar_undo_4, swar_unreachable_23, count_needed_23, covered_goal_23)
GEN_SOLVE(5, swar_place_5, swar_undo_5, swar_unreachable_5,  count_needed_5,  covered_goal_5)

/* Dispatch */
typedef int (*solve_fn)(int);
static const solve_fn solvers[6] = {0, 0, solve_n2, solve_n3, solve_n4, solve_n5};

/* ═══════════════════════════════════════════════════════
 *  Solve interface
 * ═══════════════════════════════════════════════════════ */

__attribute__((export_name("solve_init")))
void solve_init(int start, int end) {
    solve_start = start;
    solve_end = end;

    /* Copy packed initial board */
    memcpy(board_packed, board_init_packed, g_nwords * sizeof(uint64_t));

    /* Compute initial reqChange */
    req_change = 0;
    for (int i = 0; i < g_sz; i++) {
        int d = (g_goal - raw_board[i] + g_N) % g_N;
        req_change += d;
    }

    /* Init corner deficit */
    for (int ci = 0; ci < 4; ci++)
        corner_deficit[ci] = corner_needed[ci];

    /* Init solve state */
    cur_pi = 0;
    for (int i = 0; i < g_n_pieces; i++) cur_vi[i] = -1;
    cur_vi[0] = start - 1;
    memset(saved_delta, 0, sizeof(saved_delta));
    memset(saved_cmask, 0, sizeof(saved_cmask));
    memset(result_placements, 0xff, sizeof(result_placements));

    nodes_explored = 0;
    surface_skipped = 0;
    corner_skipped = 0;
    reach_skipped = 0;
}

__attribute__((export_name("solve_chunk")))
int solve_chunk(int max_nodes) {
    if (!is_prepared || g_N < 2 || g_N > 5) return 2;
    return solvers[g_N](max_nodes);
}

/* ═══════════════════════════════════════════════════════
 *  Result accessors
 * ═══════════════════════════════════════════════════════ */

__attribute__((export_name("get_placement")))
int16_t get_placement(int pi) { return result_placements[pi]; }

/* Return stats as double to avoid BigInt issues in JS */
__attribute__((export_name("get_nodes")))
double get_nodes(void) { return (double)nodes_explored; }

__attribute__((export_name("get_surface_skipped")))
double get_surface_skipped(void) { return (double)surface_skipped; }

__attribute__((export_name("get_corner_skipped")))
double get_corner_skipped(void) { return (double)corner_skipped; }

__attribute__((export_name("get_reach_skipped")))
double get_reach_skipped(void) { return (double)reach_skipped; }

__attribute__((export_name("get_orig_idx")))
uint16_t get_orig_idx(int pi) { return orig_idx[pi]; }
