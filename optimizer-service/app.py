import math
import os
import random
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model

app = Flask(__name__)
# flask-cors treats any origin string containing regex-hint characters (one of
# ()\$]?^*[ ) as a regex it compiles itself — a plain "https://*.vercel.app"
# string would be compiled as-is, and "*" right after "//" is a regex quantifier
# on "/", not a glob wildcard, so it would never actually match a real preview
# subdomain like "my-branch.vercel.app". Use a real (compiled) regex instead.
_cors_origins = [
    "http://localhost:3000",
    re.compile(r"^https://.*\.vercel\.app$"),
    "https://dfsszn.vercel.app",
]
_frontend_url = os.environ.get('FRONTEND_URL', '')
if _frontend_url:
    _cors_origins.append(_frontend_url)

CORS(app, resources={r"/*": {"origins": _cors_origins}})

SOLVER_TIME_LIMIT = 5.0

def normalize_id(pid):
    """Canonicalize a player ID so '123', 123, and 123.0 — int/float/string
    forms that can arise from JS number handling or JSON round-tripping —
    all compare equal against however the pool's own IDs happen to be typed."""
    try:
        return str(int(float(str(pid))))
    except (TypeError, ValueError):
        return str(pid)

def compute_gpp_score(players):
    for p in players:
        try:
            proj = float(p.get('projectedPoints') or 0)
            value = float(p.get('value') or 0)
            own = float(p.get('ownershipProjection') or 0)
            raw = (proj * 0.85) + (value * 0.10) - (own * 0.02)
            p['gpp_score'] = max(raw, 0)
        except Exception as e:
            print(f"GPP score error for {p.get('operatorPlayerName')}: {e}")
            p['gpp_score'] = 0
    return players

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'dfsszn-optimizer'})

@app.route('/optimize', methods=['POST'])
def optimize():
    try:
        body = request.json
        players = body.get('players', [])
        slots = body.get('slots', [])
        is_showdown = body.get('isShowdown', False)
        nfl_classic_rules = set(body.get('nflClassicRules', []))
        if nfl_classic_rules:
            print(f"NFL Classic rules: {nfl_classic_rules}")

        # DEBUG logging
        print(f"\n{'='*50}")
        print(f"Received {len(players)} players")
        print(f"Slots: {slots}")
        print(f"Min salary: {body.get('minSalary')}")
        print(f"Max salary: {body.get('maxSalary')}")
        print(f"Num lineups: {body.get('numLineups')}")

        pos_counts = {}
        for p in players:
            pos = p.get('operatorPosition', 'unknown')
            pos_counts[pos] = pos_counts.get(pos, 0) + 1
        print(f"Position breakdown: {pos_counts}")

        all_roster_slots = set()
        for p in players:
            for s in (p.get('operatorRosterSlots') or []):
                all_roster_slots.add(s)
        print(f"All roster slots in pool: {all_roster_slots}")
        print(f"{'='*50}\n")
        min_salary = body.get('minSalary', 49500)
        max_salary = body.get('maxSalary', 50000)
        num_lineups = body.get('numLineups', 1)
        locked_ids = set(body.get('lockedIds', []))
        excluded_ids = set(body.get('excludedIds', []))
        players_per_team_max = body.get('playersPerTeamMax', 5)
        players_per_game_max = body.get('playersPerGameMax', 8)
        min_unique = body.get('uniquePlayersPerLineup', 1)
        num_games = body.get('numberOfGames', 10)
        stack_team = body.get('stackTeam', None)
        stack_team_size = body.get('stackSize') or body.get('stackTeamSize') or 5
        stack_distribution = body.get('stackDistribution', [])
        print(f"Stack distribution received: {stack_distribution[:10]}...")
        print(f"Unique stacks: {list(set(s for s in stack_distribution if s))}")
        fill_pool_ids = set(body.get('fillPoolIds', []))
        # New multi-stack constraint fields
        locked_player_ids = set(normalize_id(x) for x in body.get('lockedPlayerIds', []))
        pitcher_pool_ids = set(str(x) for x in body.get('pitcherPoolIds', []))
        common_pool_ids = set(str(x) for x in body.get('commonPoolIds', []))
        showdown_pool_min = body.get('showdownPoolMin', None)
        print(f"Showdown pool min: {showdown_pool_min}, "
              f"pool size: {len(common_pool_ids)}")
        print(f"Locked players: {locked_player_ids}")
        print(f"Pitcher pool: {len(pitcher_pool_ids)} players")
        print(f"Common pool: {len(common_pool_ids)} players")
        global_exposure_caps = body.get('globalExposureCaps', {})
        global_exposure_actual = {str(k): int(v) for k, v in body.get('globalExposureActual', {}).items()}
        total_lineups_so_far = int(body.get('totalLineupsSoFar', 0))
        # ownership_targets: {slatePlayerId: target_pct}
        ownership_targets = body.get('ownershipTargets', {})
        print(f"Ownership targets received: {ownership_targets}")
        print(f"Stack team: {stack_team}, Stack size: {stack_team_size}")

        # Filter out excluded players
        players = [p for p in players if p['slatePlayerId'] not in excluded_ids]
        print(f"After excluding: {len(players)} players remain")

        # Add locked flag
        for p in players:
            p['locked'] = p['slatePlayerId'] in locked_ids

        # Normalize showdown fields — tolerate either casing in case a caller
        # sends the frontend's original PascalCase names instead of camelCase.
        for p in players:
            if 'isCaptain' not in p:
                roster_slots = p.get('operatorRosterSlots', []) or []
                p['isCaptain'] = 'CPT' in roster_slots
            if 'captainBaseId' not in p:
                p['captainBaseId'] = p.get('CaptainBaseId')

        # Compute GPP score
        players = compute_gpp_score(players)
        print(f"After GPP score: {len(players)} players")

        # Build index
        n = len(players)
        if n == 0:
            return jsonify({'success': False, 'error': 'No players available'})
        print(f"Player count n={n}, starting solver loop")

        all_lineups = []
        seen_lineups = set()
        previous_lineups = []

        solver_obj = cp_model.CpSolver()
        solver_obj.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT

        # Determine slot position mapping
        slot_positions = {
            'P': ['SP', 'RP', 'P'],
            'C': ['C', '1B/C', 'C/1B'],
            '1B': ['1B', '1B/C', '1B/OF', '1B/3B', 'C/1B'],
            '2B': ['2B', '2B/3B', '2B/SS', 'SS/2B', '3B/2B'],
            '3B': ['3B', '3B/OF', '3B/2B', '2B/3B', '1B/3B', '3B/OF'],
            'SS': ['SS', 'SS/2B', '2B/SS'],
            'OF': ['OF', '1B/OF', '3B/OF', 'OF/3B', 'OF/1B'],
            'FLEX': ['RB', 'WR', 'TE', 'RB/WR', 'WR/RB'],
            'QB': ['QB'],
            'RB': ['RB', 'RB/WR'],
            'WR': ['WR', 'WR/RB'],
            'TE': ['TE'],
            'K': ['K'],
            'DST': ['DST'],
            'PG': ['PG', 'PG/SG', 'SG/PG'],
            'SG': ['SG', 'SG/PG', 'PG/SG'],
            'SF': ['SF', 'SF/PF', 'PF/SF'],
            'PF': ['PF', 'PF/SF', 'SF/PF'],
        }

        def player_fits_slot(player, slot):
            pos = player.get('operatorPosition', '') or ''
            roster_slots = player.get('operatorRosterSlots', []) or []

            # Direct roster slot match — most reliable
            if slot in roster_slots:
                return True

            # P slot accepts SP, RP, P
            if slot == 'P':
                return pos in ['SP', 'RP', 'P'] or 'P' in roster_slots

            # FLEX slot
            if slot == 'FLEX':
                flex_pos = ['RB', 'WR', 'TE']
                if pos in flex_pos:
                    return True
                if '/' in pos:
                    return any(p in flex_pos for p in pos.split('/'))
                return False

            # NFL defense: DK labels it DST, FanDuel labels it DEF — accept either
            # slot name for either label (roster-slot match above already covers
            # this when operatorRosterSlots is populated; this is the fallback)
            if slot in ['DST', 'DEF']:
                return pos in ['DST', 'DEF', 'D/ST']

            # Multi-position players like "1B/C", "2B/3B", "3B/OF"
            if '/' in pos:
                parts = [p.strip() for p in pos.split('/')]
                if slot in parts:
                    return True

            # Direct position match
            if pos == slot:
                return True

            # Check slot_positions mapping
            valid = slot_positions.get(slot, [slot])
            if pos in valid:
                return True

            return False

        # Detect NFL slates by the presence of NFL-only positions. NFL stacking
        # (QB + pass catchers) and MLB stacking (5-hitter + catcher) are different
        # enough that the stack constraint logic below branches on this.
        is_nfl = any(
            p.get('operatorPosition') in ['QB', 'RB', 'WR', 'TE', 'DST', 'DEF']
            for p in players
        )
        print(f"Sport detected: {'NFL' if is_nfl else 'MLB'}")
        # is_mlb also covers NBA (this optimizer never branched MLB vs NBA before
        # the NFL work — NBA lineups fall through the same "not NFL" path they
        # always did). Detection stays position-based rather than slot-based:
        # slot strings collide across sports ('FLEX' is used by both NFL and NBA,
        # 'C' means Catcher in MLB and Center in NBA), so a slots-only check
        # would misclassify NBA slates as NFL/MLB. operatorPosition values
        # (QB/RB/WR/TE/DST/DEF) are unambiguous across all three sports.
        is_mlb = not is_nfl

        if is_showdown:
            # Showdown players still carry real NFL positions (QB/RB/WR/TE/K/
            # DST), so the position-based is_nfl check above would already be
            # True — but the classic NFL slot logic expects QB/RB/WR/TE/FLEX/
            # DST slots, not the CPT/FLEX slots a showdown request actually
            # sends. Force both off so neither classic branch runs.
            is_nfl = False
            is_mlb = False
            print("Mode: NFL Showdown")

        stack_min_size = 3 if is_nfl else 5  # NFL: QB + 2 pass catchers minimum

        lineup_num = 0
        attempt = 0
        max_attempts = num_lineups * 60
        player_usage_count = {}
        stack_team_usage = {}
        consecutive_failures = 0
        max_consecutive_failures = 150

        while lineup_num < num_lineups and attempt < max_attempts and consecutive_failures < max_consecutive_failures:
            attempt += 1

            # Get stack for this specific lineup number
            if stack_distribution and lineup_num < len(stack_distribution):
                current_stack = stack_distribution[lineup_num]
            elif stack_team:
                current_stack = stack_team
            else:
                current_stack = None

            print(f"\nLineup {lineup_num+1}/{num_lineups} | attempt {attempt} | stack: {current_stack}")

            model = cp_model.CpModel()
            vars_list = [model.NewBoolVar(f'p_{i}') for i in range(n)]

            # Separate pitchers and hitters/skill players. NFL has no pitcher
            # concept at all — every player is a "hitter" for the purposes of
            # the slot/whitelist/stack logic below (explicit branch instead of
            # relying on the generic filter finding zero matches, for clarity).
            # Computed before the auto-stack selection below (which needs
            # hitter_indices) and before opposing_team is resolved (which needs
            # the final current_stack, auto-selected or not).
            if is_nfl:
                pitcher_indices = []
                hitter_indices = list(range(n))
            else:
                pitcher_indices = [
                    i for i, p in enumerate(players)
                    if p.get('operatorPosition') in ['SP', 'RP', 'P']
                    or 'P' in (p.get('operatorRosterSlots') or [])
                ]
                hitter_indices = [
                    i for i, p in enumerate(players)
                    if p.get('operatorPosition') not in ['SP', 'RP', 'P']
                    and 'P' not in (p.get('operatorRosterSlots') or [])
                ]
            print(f"Pool: {len(pitcher_indices)} pitchers, {len(hitter_indices)} hitters/skill players")

            # Auto-select a stack team for MLB when none was explicitly
            # requested. Without this, an MLB lineup with no stack chosen
            # optimizes with zero team correlation at all — every hitter
            # picked independently. Scored by average projection, penalized
            # by how often that team has already been used this batch (via
            # stack_team_usage) so lineups don't all glom onto the same team,
            # plus a little noise for variety between otherwise-similar teams.
            if is_mlb and not current_stack:
                team_projections = {}
                for i in hitter_indices:
                    team = players[i].get('team', '')
                    proj = float(players[i].get('projectedPoints') or 0)
                    if team:
                        team_projections.setdefault(team, []).append(proj)

                best_team = None
                best_score = -999
                for team, projs in team_projections.items():
                    if len(projs) >= 4:
                        avg = sum(projs) / len(projs)
                        usage_penalty = stack_team_usage.get(team, 0) * 2
                        noise = random.uniform(-1.5, 1.5)
                        score = avg - usage_penalty + noise
                        if score > best_score:
                            best_score = score
                            best_team = team

                if best_team:
                    current_stack = best_team
                    print(f"Auto-stack: {current_stack} (score: {best_score:.1f}, "
                          f"used: {stack_team_usage.get(best_team, 0)}x)")

            # Resolve opposing team for this lineup's specific stack
            opposing_team = None
            if current_stack:
                for p in players:
                    if p.get('team') == current_stack:
                        opp = p.get('opponent') or p.get('Opponent') or p.get('opp')
                        if opp:
                            opposing_team = str(opp).upper().strip()
                            break

                if not opposing_team:
                    stack_game_ids = set(
                        str(p.get('slateGameId') or p.get('SlateGameID', ''))
                        for p in players
                        if p.get('team') == current_stack
                    )
                    for p in players:
                        p_game = str(p.get('slateGameId') or p.get('SlateGameID', ''))
                        if (p_game in stack_game_ids and
                                p_game != '' and
                                p.get('team') != current_stack and
                                p.get('operatorPosition') not in ['SP', 'RP']):
                            opposing_team = str(p.get('team', '')).upper().strip()
                            break

                print(f"Stack: {current_stack} vs {opposing_team or 'NOT FOUND'}")

            # Lock required players (old per-player locked flag)
            for i, p in enumerate(players):
                if p['locked']:
                    model.Add(vars_list[i] == 1)

            # LOCKED PLAYERS — force x[i] = 1. Uses the same normalize_id() as
            # locked_player_ids itself (previously this compared a raw,
            # non-normalized str(slatePlayerId) against normalized IDs, so an
            # int/float mismatch here could pass the constraint loop below but
            # still fail this list — locked_indices also exempts these players
            # from the common-pool whitelist further down, so a mismatch there
            # could leave a player simultaneously forced to 1 and to 0).
            locked_indices = [
                i for i, p in enumerate(players)
                if p.get('slatePlayerId') is not None
                and normalize_id(p.get('slatePlayerId')) in locked_player_ids
            ]
            if locked_player_ids:
                locked_found = []
                for i in locked_indices:
                    model.Add(vars_list[i] == 1)
                    locked_found.append(players[i].get('operatorPlayerName'))
                print(f"Locked players found and constrained: {locked_found}")

                found_ids = set(
                    normalize_id(p.get('slatePlayerId'))
                    for p in players
                    if p.get('slatePlayerId') is not None
                )
                missing = locked_player_ids - found_ids
                if missing:
                    print(f"WARNING: Locked IDs not found in player pool: {missing}")
                    print(f"Pool ID sample: {list(found_ids)[:5]}")

            # PITCHER POOL WHITELIST
            if pitcher_pool_ids:
                for i in pitcher_indices:
                    pid = str(players[i].get('slatePlayerId', ''))
                    if pid not in pitcher_pool_ids:
                        model.Add(vars_list[i] == 0)

            # COMMON POOL WHITELIST (DST/DEF/K are unique single-copy positions —
            # never let a whitelist built from hitters/pass-catchers exclude them)
            # Showdown is excluded here: its common pool is a minimum-inclusion
            # constraint ("at least N of these must appear"), not a hard
            # whitelist — see SHOWDOWN COMMON POOL MINIMUM below. Applying this
            # whitelist too would lock every non-pool player to 0, which for a
            # 6-player showdown roster is almost always instantly infeasible.
            if common_pool_ids and not is_showdown:
                for i in hitter_indices:
                    pid = str(players[i].get('slatePlayerId', ''))
                    # normalize_id() here, not the raw pid above, so this matches
                    # the same locked_player_ids a mismatched int/float ID would
                    # otherwise slip through — see locked_indices above.
                    p_locked = normalize_id(players[i].get('slatePlayerId')) in locked_player_ids
                    p_pos = players[i].get('operatorPosition', '')
                    if p_pos in ['DST', 'DEF', 'K']:
                        continue
                    if not p_locked and pid not in common_pool_ids:
                        model.Add(vars_list[i] == 0)

            # Stack-dependent index lists (recalculated each lineup after opposing_team is resolved)
            current_stack_indices = [
                i for i in hitter_indices
                if players[i].get('team') == current_stack
            ] if current_stack else []

            opposing_hitter_indices = [
                i for i in hitter_indices
                if players[i].get('team') == opposing_team
                and (not is_nfl or players[i].get('operatorPosition') in ['WR', 'TE', 'RB'])
            ] if opposing_team else []

            non_stack_non_opp_indices = [
                i for i in hitter_indices
                if players[i].get('team') != current_stack
                and players[i].get('team') != opposing_team
            ] if current_stack else hitter_indices

            # MLB-only: feeds the "secondary hitter" objective boost below, which
            # is skipped entirely for NFL (is_mlb-gated) — don't bother computing it.
            best_secondary_idx = None
            if is_mlb and non_stack_non_opp_indices:
                best_secondary_idx = max(
                    non_stack_non_opp_indices,
                    key=lambda i: float(players[i].get('projectedPoints') or 0)
                )

            # Common pool whitelist: non-locked hitters must come from common pool
            # (DST/DEF/K exempted — see COMMON POOL WHITELIST above). Same
            # showdown exclusion as above.
            if common_pool_ids and not is_showdown:
                for i in hitter_indices:
                    pid = str(players[i].get('slatePlayerId', ''))
                    p_pos = players[i].get('operatorPosition', '')
                    if p_pos in ['DST', 'DEF', 'K']:
                        continue
                    if pid not in common_pool_ids and i not in locked_indices:
                        model.Add(vars_list[i] == 0)

            # Global exposure caps: exclude players who've hit their cap
            if global_exposure_caps:
                total_target = total_lineups_so_far + num_lineups
                for pid_str, cap_pct in global_exposure_caps.items():
                    current_count = global_exposure_actual.get(str(pid_str), 0)
                    max_allowed = math.floor(float(cap_pct) / 100.0 * total_target)
                    remaining_allowed = max_allowed - current_count
                    player_idx = next(
                        (i for i, p in enumerate(players)
                         if str(p.get('slatePlayerId', '')) == str(pid_str)),
                        None
                    )
                    if player_idx is not None and remaining_allowed <= 0:
                        model.Add(vars_list[player_idx] == 0)
                        print(f"Exposure cap: {pid_str} excluded ({current_count}/{max_allowed})")

            # Fill pool hitter indices (exclude current stack team)
            fill_pool_hitter_indices = [
                i for i in hitter_indices
                if players[i].get('slatePlayerId') in fill_pool_ids
                and players[i].get('team') != current_stack
            ] if fill_pool_ids else []

            # Non-stack hitter indices (fallback if fill pool empty)
            non_stack_hitter_indices = [
                i for i in hitter_indices
                if players[i].get('team') != current_stack
            ]

            print(f"Stack hitters: {len(current_stack_indices)} | "
                  f"Opp hitters: {len(opposing_hitter_indices)} | "
                  f"Other: {len(non_stack_non_opp_indices)}")
            print(f"Pitchers available: {len(pitcher_indices)} | "
                  f"Fill pool hitters: {len(fill_pool_hitter_indices)}")

            # Slot constraints
            slot_counts = {}
            for slot in slots:
                slot_counts[slot] = slot_counts.get(slot, 0) + 1

            if is_nfl:
                # NFL's FLEX slot is RB/WR/TE-eligible, and every RB/WR/TE player
                # is therefore ALSO FLEX-eligible (100% overlap, unlike MLB's rare
                # multi-position tags). Giving each slot type its own independent
                # "== count" constraint double-counts those overlapping players —
                # selecting the required 2 RB + 3 WR + 1 TE already puts 6 players
                # in the FLEX-eligible pool, which can never equal the FLEX slot's
                # own "== 1" requirement. That contradiction made every NFL lineup
                # with a FLEX slot INFEASIBLE.
                #
                # Fix: give RB/WR/TE a lower bound (">=" their own slot count) and
                # let a single "==" constraint pin the TOTAL RB+WR+TE+FLEX pool
                # to exactly how many skill slots exist — the solver is then free
                # to decide which position supplies the extra FLEX body.
                def slot_fail(slot_name):
                    print(f"  Available positions: {sorted(set(p.get('operatorPosition', '') for p in players))}")
                    return jsonify({'success': False, 'error': f'No players for slot {slot_name}'})

                if 'QB' in slot_counts:
                    qb_eligible = [i for i in range(n) if player_fits_slot(players[i], 'QB')]
                    print(f"Slot QB: {len(qb_eligible)} eligible (need {slot_counts['QB']})")
                    if not qb_eligible:
                        return slot_fail('QB')
                    model.Add(sum(vars_list[i] for i in qb_eligible) == slot_counts['QB'])

                rb_count = slot_counts.get('RB', 0)
                wr_count = slot_counts.get('WR', 0)
                te_count = slot_counts.get('TE', 0)
                flex_count = slot_counts.get('FLEX', 0)

                if rb_count:
                    rb_eligible = [i for i in range(n) if player_fits_slot(players[i], 'RB')]
                    print(f"Slot RB: {len(rb_eligible)} eligible (need >= {rb_count})")
                    if len(rb_eligible) < rb_count:
                        return slot_fail('RB')
                    model.Add(sum(vars_list[i] for i in rb_eligible) >= rb_count)

                if wr_count:
                    wr_eligible = [i for i in range(n) if player_fits_slot(players[i], 'WR')]
                    print(f"Slot WR: {len(wr_eligible)} eligible (need >= {wr_count})")
                    if len(wr_eligible) < wr_count:
                        return slot_fail('WR')
                    model.Add(sum(vars_list[i] for i in wr_eligible) >= wr_count)

                if te_count:
                    te_eligible = [i for i in range(n) if player_fits_slot(players[i], 'TE')]
                    print(f"Slot TE: {len(te_eligible)} eligible (need >= {te_count})")
                    if len(te_eligible) < te_count:
                        return slot_fail('TE')
                    model.Add(sum(vars_list[i] for i in te_eligible) >= te_count)

                if flex_count:
                    flex_eligible = [i for i in range(n) if player_fits_slot(players[i], 'FLEX')]
                    skill_needed = rb_count + wr_count + te_count + flex_count
                    print(f"Slot FLEX: {len(flex_eligible)} RB/WR/TE-eligible "
                          f"(need == {skill_needed} total across RB+WR+TE+FLEX)")
                    if len(flex_eligible) < skill_needed:
                        return slot_fail('FLEX')
                    model.Add(sum(vars_list[i] for i in flex_eligible) == skill_needed)

                if 'K' in slot_counts:
                    k_eligible = [i for i in range(n) if player_fits_slot(players[i], 'K')]
                    print(f"Slot K: {len(k_eligible)} eligible (need {slot_counts['K']})")
                    if not k_eligible:
                        return slot_fail('K')
                    model.Add(sum(vars_list[i] for i in k_eligible) == slot_counts['K'])

                dst_slot = 'DST' if 'DST' in slot_counts else ('DEF' if 'DEF' in slot_counts else None)
                if dst_slot:
                    dst_eligible = [i for i in range(n) if player_fits_slot(players[i], dst_slot)]
                    print(f"Slot {dst_slot}: {len(dst_eligible)} eligible (need {slot_counts[dst_slot]})")
                    if not dst_eligible:
                        return slot_fail(dst_slot)
                    model.Add(sum(vars_list[i] for i in dst_eligible) == slot_counts[dst_slot])

                print(f"NFL slot constraints applied: {slot_counts}")
            elif is_showdown:
                # Showdown: CPT + 5 FLEX. This branch is fully self-contained —
                # it builds its own salary/objective/diversity constraints and
                # solves/accepts the lineup itself, then `continue`s straight
                # to the next while-loop iteration. That's deliberate: none of
                # the classic MLB/NFL constraints below (team stacks, bring-
                # back, anti-correlation, per-game caps) apply to a single-game
                # showdown slate, and skipping them via `continue` is simpler
                # and less error-prone than gating every one of those blocks
                # with "and not is_showdown".
                cpt_indices = [
                    i for i in range(n)
                    if players[i].get('operatorRosterSlots') and
                    'CPT' in players[i].get('operatorRosterSlots', [])
                ]
                flex_indices = [
                    i for i in range(n)
                    if players[i].get('operatorRosterSlots') and
                    'FLEX' in players[i].get('operatorRosterSlots', [])
                ]

                print(f"Showdown: {len(cpt_indices)} CPT options, "
                      f"{len(flex_indices)} FLEX options")

                # Prevent same player appearing as both CPT and FLEX.
                # CPT entries now carry an ID of baseId + 100000, but we still
                # key off captainBaseId/slatePlayerId (rather than reversing
                # the ID arithmetic) so this keeps working regardless of how
                # the frontend derives a CPT entry's ID.
                for i in cpt_indices:
                    base_id = players[i].get('captainBaseId')
                    if base_id is None:
                        continue
                    # Find the FLEX version of the same player
                    flex_version = next((
                        j for j in flex_indices
                        if players[j].get('slatePlayerId') == base_id
                    ), None)
                    if flex_version is not None:
                        model.Add(
                            vars_list[i] + vars_list[flex_version] <= 1
                        )

                # Exactly 1 CPT
                if cpt_indices:
                    model.Add(
                        sum(vars_list[i] for i in cpt_indices) == 1
                    )

                # Exactly 5 FLEX
                if flex_indices:
                    model.Add(
                        sum(vars_list[i] for i in flex_indices) == len(slots) - 1
                    )

                # Total 6 players
                model.Add(sum(vars_list) == len(slots))

                # Salary constraint
                salary_expr = sum(
                    vars_list[i] * int(
                        players[i].get('operatorSalary', 0) or 0
                    )
                    for i in range(n)
                )
                model.Add(salary_expr >= min_salary - 1000)
                model.Add(salary_expr <= max_salary)

                # Extract showdown rules from request
                showdown_rules = set(body.get('showdownRules', []))
                print(f"Showdown rules active: {showdown_rules}")

                # Build helper lookups
                def get_ownership(p):
                    return float(p.get('ownershipProjection') or 0)

                def get_proj(p):
                    return float(p.get('projectedPoints') or 0)

                skill_positions = ['QB', 'RB', 'WR', 'TE']

                # ── RULE: cpt_skill_only ──────────────────────────
                # Captain must be QB, RB, WR, or TE
                if 'cpt_skill_only' in showdown_rules:
                    non_skill_cpt = [
                        i for i in cpt_indices
                        if players[i].get('operatorPosition', '')
                           not in skill_positions
                    ]
                    for i in non_skill_cpt:
                        model.Add(vars_list[i] == 0)
                    print(f"Rule cpt_skill_only: blocked "
                          f"{len(non_skill_cpt)} non-skill CPT options")

                # ── RULE: no_dst_cpt ─────────────────────────────
                if 'no_dst_cpt' in showdown_rules:
                    dst_cpt = [
                        i for i in cpt_indices
                        if players[i].get('operatorPosition', '')
                           in ['DST', 'DEF', 'D/ST']
                    ]
                    for i in dst_cpt:
                        model.Add(vars_list[i] == 0)
                    print(f"Rule no_dst_cpt: blocked {len(dst_cpt)}")

                # ── RULE: no_kicker_cpt ──────────────────────────
                if 'no_kicker_cpt' in showdown_rules:
                    k_cpt = [
                        i for i in cpt_indices
                        if players[i].get('operatorPosition', '') == 'K'
                    ]
                    for i in k_cpt:
                        model.Add(vars_list[i] == 0)
                    print(f"Rule no_kicker_cpt: blocked {len(k_cpt)}")

                # ── RULE: cpt_low_own ────────────────────────────
                # CPT must be under 20% ownership — but never block every
                # captain option outright: a CP-SAT constraint, once added,
                # can't be un-added later, so the "would this leave zero
                # options" check has to happen BEFORE adding anything.
                if 'cpt_low_own' in showdown_rules:
                    high_own_cpt = [
                        i for i in cpt_indices
                        if get_ownership(players[i]) >= 20
                    ]
                    remaining_cpt = len(cpt_indices) - len(high_own_cpt)
                    if remaining_cpt == 0:
                        print("WARNING: cpt_low_own would block all captains — "
                              "skipping this rule")
                    else:
                        for i in high_own_cpt:
                            model.Add(vars_list[i] == 0)
                        print(f"Rule cpt_low_own: blocked {len(high_own_cpt)} "
                              f"high-own CPTs, {remaining_cpt} remain")

                # ── RULE: cpt_high_proj ──────────────────────────
                # CPT must be top 5 projected
                if 'cpt_high_proj' in showdown_rules:
                    sorted_by_proj = sorted(
                        range(n),
                        key=lambda i: get_proj(players[i]),
                        reverse=True
                    )
                    top5_ids = set(sorted_by_proj[:5])
                    low_proj_cpt = [
                        i for i in cpt_indices
                        if i not in top5_ids
                    ]
                    # Only block if enough top5 CPT options remain
                    top5_cpt = [i for i in cpt_indices if i in top5_ids]
                    if top5_cpt:
                        for i in low_proj_cpt:
                            model.Add(vars_list[i] == 0)
                        print(f"Rule cpt_high_proj: {len(top5_cpt)} "
                              f"top-5 CPT options")

                # ── RULE: flex_one_low_own ───────────────────────
                # At least 1 FLEX under 20% ownership
                if 'flex_one_low_own' in showdown_rules:
                    low_own_flex = [
                        i for i in flex_indices
                        if get_ownership(players[i]) < 20
                    ]
                    if low_own_flex:
                        model.Add(
                            sum(vars_list[i] for i in low_own_flex) >= 1
                        )
                        print(f"Rule flex_one_low_own: "
                              f"{len(low_own_flex)} eligible")
                    else:
                        print("Rule flex_one_low_own: no low-own FLEX "
                              "available — skipping")

                # ── RULE: flex_min_own ───────────────────────────
                # All FLEX must be at least 5% owned
                if 'flex_min_own' in showdown_rules:
                    zero_own_flex = [
                        i for i in flex_indices
                        if get_ownership(players[i]) < 5
                    ]
                    for i in zero_own_flex:
                        model.Add(vars_list[i] == 0)
                    print(f"Rule flex_min_own: blocked "
                          f"{len(zero_own_flex)} under-5% FLEX")

                # ── RULE: must_have_qb_or_dst ────────────────────
                if 'must_have_qb_or_dst' in showdown_rules:
                    qb_dst_all = [
                        i for i in range(n)
                        if players[i].get('operatorPosition', '')
                           in ['QB', 'DST', 'DEF']
                    ]
                    if qb_dst_all:
                        model.Add(
                            sum(vars_list[i] for i in qb_dst_all) >= 1
                        )
                        print(f"Rule must_have_qb_or_dst: "
                              f"{len(qb_dst_all)} eligible")

                # ── RULE: stack_same_team ────────────────────────
                if 'stack_same_team' in showdown_rules:
                    teams_in_pool = list(set(
                        p.get('team', '') for p in players
                        if p.get('team')
                    ))
                    if len(teams_in_pool) >= 2:
                        team_vars = {
                            team: model.NewBoolVar(f'stack_{team}')
                            for team in teams_in_pool
                        }
                        model.Add(sum(team_vars.values()) >= 1)
                        for team, team_var in team_vars.items():
                            team_indices = [
                                i for i in range(n)
                                if players[i].get('team') == team
                            ]
                            model.Add(
                                sum(vars_list[i] for i in team_indices) >= 3
                            ).OnlyEnforceIf(team_var)
                            model.Add(
                                sum(vars_list[i] for i in team_indices) <= 2
                            ).OnlyEnforceIf(team_var.Not())
                        print("Rule stack_same_team: min 3 from one team")

                # ── RULE: both_teams / both_teams_required ───────
                if 'both_teams' in showdown_rules or \
                   'both_teams_required' in showdown_rules:
                    teams_in_pool = list(set(
                        p.get('team', '') for p in players
                        if p.get('team')
                    ))
                    for team in teams_in_pool:
                        team_indices = [
                            i for i in range(n)
                            if players[i].get('team') == team
                        ]
                        if team_indices:
                            model.Add(
                                sum(vars_list[i] for i in team_indices) >= 1
                            )
                    print(f"Rule both_teams: must include all "
                          f"{len(teams_in_pool)} teams")

                # ── RULE: qb_cpt_stack ───────────────────────────
                # If QB is captain, require 2+ teammates in FLEX
                if 'qb_cpt_stack' in showdown_rules:
                    print("Rule qb_cpt_stack: enforcing QB captain "
                          "teammate correlation")

                    # Get all QB CPT options
                    qb_cpt_indices = [
                        i for i in cpt_indices
                        if players[i].get('operatorPosition') == 'QB'
                    ]

                    if not qb_cpt_indices:
                        print("  No QB CPT options available — "
                              "skipping qb_cpt_stack rule")
                    else:
                        # For each possible QB captain, create a
                        # binary variable and conditional constraints
                        for qb_idx in qb_cpt_indices:
                            qb_team = players[qb_idx].get('team', '')

                            # Find FLEX teammates (WR/RB/TE/K from same team)
                            teammate_flex = [
                                i for i in flex_indices
                                if players[i].get('team') == qb_team
                                and players[i].get('operatorPosition')
                                    in ['WR', 'RB', 'TE', 'K']
                            ]

                            print(f"  QB {players[qb_idx].get('operatorPlayerName')} "
                                  f"({qb_team}): "
                                  f"{len(teammate_flex)} eligible teammates")

                            if len(teammate_flex) >= 2:
                                # If this QB is the captain,
                                # enforce 2+ teammates in FLEX
                                # Use OnlyEnforceIf for conditional constraint
                                qb_is_cpt = model.NewBoolVar(
                                    f'qb_is_cpt_{qb_idx}'
                                )

                                # qb_is_cpt is True when this QB is selected
                                model.Add(
                                    vars_list[qb_idx] == 1
                                ).OnlyEnforceIf(qb_is_cpt)
                                model.Add(
                                    vars_list[qb_idx] == 0
                                ).OnlyEnforceIf(qb_is_cpt.Not())

                                # When this QB is captain,
                                # require 2+ teammates
                                model.Add(
                                    sum(vars_list[i]
                                        for i in teammate_flex) >= 2
                                ).OnlyEnforceIf(qb_is_cpt)

                                print(f"  Conditional: if {players[qb_idx].get('operatorPlayerName')} "
                                      f"is CPT → 2+ from {qb_team} in FLEX")

                            elif len(teammate_flex) == 1:
                                # Only 1 teammate available — require 1
                                qb_is_cpt = model.NewBoolVar(
                                    f'qb_is_cpt_{qb_idx}'
                                )
                                model.Add(
                                    vars_list[qb_idx] == 1
                                ).OnlyEnforceIf(qb_is_cpt)
                                model.Add(
                                    vars_list[qb_idx] == 0
                                ).OnlyEnforceIf(qb_is_cpt.Not())
                                model.Add(
                                    sum(vars_list[i]
                                        for i in teammate_flex) >= 1
                                ).OnlyEnforceIf(qb_is_cpt)

                                print(f"  Only 1 teammate available — "
                                      f"requiring 1 when {players[qb_idx].get('operatorPlayerName')} "
                                      f"is CPT")

                            else:
                                # No teammates available for this QB
                                # Block this QB from being captain
                                # to avoid unenforceable constraint
                                model.Add(vars_list[qb_idx] == 0)
                                print(f"  No teammates for {players[qb_idx].get('operatorPlayerName')} "
                                      f"— blocked as CPT")

                        # Also handle the case where a NON-QB is captain
                        # (rule only applies when QB is CPT so no
                        # additional constraint needed for other CPTs)

                        non_qb_cpt = [
                            i for i in cpt_indices
                            if players[i].get('operatorPosition') != 'QB'
                        ]
                        print(f"  Non-QB CPT options (unrestricted): "
                              f"{len(non_qb_cpt)}")

                print("Showdown rules applied. Solving...")

                # ── SHOWDOWN COMMON POOL MINIMUM ─────────────────
                if showdown_pool_min and common_pool_ids:
                    # Find all players (CPT or FLEX) in the pool
                    pool_player_indices = [
                        i for i in range(n)
                        if str(players[i].get('slatePlayerId', ''))
                           in common_pool_ids
                        or str(players[i].get('captainBaseId', ''))
                           in common_pool_ids
                    ]

                    # Clamp against the number of DISTINCT real players, not
                    # the raw index count above — each real player contributes
                    # two rows (FLEX + CPT), but the CPT/FLEX exclusivity
                    # constraint means at most one of those two can ever be
                    # selected. Clamping against the doubled count would let
                    # actual_min exceed what's actually achievable and force
                    # the model infeasible whenever the pool has 2+ players.
                    pool_base_ids = set()
                    for i in pool_player_indices:
                        slate_id = str(players[i].get('slatePlayerId', ''))
                        base_id = str(players[i].get('captainBaseId', ''))
                        pool_base_ids.add(slate_id if slate_id in common_pool_ids else base_id)

                    actual_min = min(
                        showdown_pool_min,
                        len(pool_base_ids)
                    )

                    if pool_player_indices and actual_min > 0:
                        model.Add(
                            sum(vars_list[i]
                                for i in pool_player_indices)
                            >= actual_min
                        )
                        print(f"Showdown pool constraint: "
                              f">= {actual_min} from pool "
                              f"({len(pool_player_indices)} eligible)")
                    else:
                        print(f"Showdown pool: no eligible players found")

                # Showdown objective: maximize GPP score with captain boost
                # for high-ceiling players
                objective_terms = []
                for i in range(n):
                    base_score = int(
                        (players[i].get('gpp_score', 0) or 0) * 100
                    )
                    usage_penalty = player_usage_count.get(i, 0) * 20
                    random_noise = random.randint(-10, 10)

                    # Extra noise for captain slot (encourage variety in captain picks)
                    is_cpt = 'CPT' in (
                        players[i].get('operatorRosterSlots') or []
                    )
                    # For CPT slot add projection-weighted boost
                    # so high-projection players get captained more
                    if is_cpt:
                        proj = float(players[i].get('projectedPoints') or 0)
                        cpt_boost = int(proj * 10)
                        cpt_noise = random.randint(-20, 20)
                    else:
                        cpt_boost = 0
                        cpt_noise = 0

                    adjusted = max(
                        base_score - usage_penalty + random_noise +
                        cpt_boost + cpt_noise,
                        1
                    )
                    objective_terms.append(vars_list[i] * adjusted)

                model.Maximize(sum(objective_terms))

                # Diversity for showdown — look back at ALL previous lineups
                # not just 20, and enforce stronger uniqueness
                lookback = min(len(previous_lineups), 50)
                for prev in previous_lineups[-lookback:]:
                    overlap_allowed = max(
                        len(slots) - max(min_unique, 3),
                        len(slots) - 5
                    )
                    model.Add(
                        sum(vars_list[i] for i in prev)
                        <= overlap_allowed
                    )

                # Solve
                status = solver_obj.Solve(model)

                if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    selected = [
                        i for i in range(n)
                        if solver_obj.Value(vars_list[i])
                    ]
                    lineup_key = tuple(sorted(selected))

                    if lineup_key in seen_lineups:
                        consecutive_failures += 1
                        print(f"Duplicate lineup detected — skipping")
                        continue

                    seen_lineups.add(lineup_key)
                    previous_lineups.append(selected)

                    lineup_players = [players[i] for i in selected]

                    # Validate showdown lineup has exactly 6 players. The
                    # CP-SAT constraints above already guarantee this, but a
                    # solved-but-malformed lineup is exactly the kind of thing
                    # that should never silently reach the frontend.
                    if len(lineup_players) != 6:
                        print(f"WARNING: Showdown lineup has "
                              f"{len(lineup_players)} players, expected 6")
                        consecutive_failures += 1
                        continue

                    # Validate exactly 1 CPT and 5 FLEX
                    cpt_count = sum(1 for p in lineup_players
                        if 'CPT' in (p.get('operatorRosterSlots') or []))
                    flex_count = sum(1 for p in lineup_players
                        if 'FLEX' in (p.get('operatorRosterSlots') or []))

                    if cpt_count != 1 or flex_count != 5:
                        print(f"WARNING: Invalid showdown lineup - "
                              f"CPT:{cpt_count} FLEX:{flex_count}")
                        consecutive_failures += 1
                        continue

                    total_salary = sum(
                        p.get('operatorSalary', 0) or 0
                        for p in lineup_players
                    )
                    total_proj = sum(
                        p.get('projectedPoints', 0) or 0
                        for p in lineup_players
                    )

                    # Find the captain
                    captain = next((
                        p for p in lineup_players
                        if 'CPT' in (p.get('operatorRosterSlots') or [])
                    ), None)

                    print(f"Showdown lineup {lineup_num+1}: "
                          f"CPT={captain.get('operatorPlayerName', '?') if captain else '?'} "
                          f"Salary=${total_salary:,}")
                    print(f"✓ Showdown lineup valid: "
                          f"CPT:{cpt_count} FLEX:{flex_count} "
                          f"Total:${total_salary:,}")

                    all_lineups.append({
                        'players': [
                            {
                                'slatePlayerId': p.get('slatePlayerId'),
                                'captainBaseId': p.get('captainBaseId'),
                                'operatorPlayerName': (
                                    (p.get('operatorPlayerName') or '')
                                    .replace(' (CPT)', '')
                                    .strip()
                                ),
                                'operatorPosition': p.get('operatorPosition'),
                                'operatorSalary': p.get('operatorSalary'),
                                'operatorRosterSlots': p.get('operatorRosterSlots', []),
                                'team': p.get('team'),
                                'projectedPoints': p.get('projectedPoints'),
                                'isCaptain': bool(p.get('isCaptain', False)),
                                'slot': 'CPT' if p.get('isCaptain') else 'FLEX'
                            }
                            for p in lineup_players
                        ],
                        'totalSalary': total_salary,
                        'projectedPoints': round(total_proj, 2)
                    })

                    for idx in selected:
                        player_usage_count[idx] = (
                            player_usage_count.get(idx, 0) + 1
                        )

                    lineup_num += 1
                    consecutive_failures = 0

                else:
                    consecutive_failures += 1
                    print(f"Showdown INFEASIBLE attempt {attempt}")
                    continue

                # Skip the rest of the loop for showdown
                continue
            else:
                for slot, count in slot_counts.items():
                    if slot == 'P':
                        eligible = pitcher_indices
                    elif current_stack:
                        eligible = [
                            i for i in hitter_indices
                            if player_fits_slot(players[i], slot)
                        ]
                    else:
                        eligible = [
                            i for i, p in enumerate(players)
                            if player_fits_slot(p, slot)
                        ]

                    print(f"Slot {slot}: {len(eligible)} eligible (need {count})")
                    if not eligible:
                        print(f"  Available positions: {[players[i].get('operatorPosition') for i in hitter_indices[:5]]}")
                        return jsonify({'success': False, 'error': f'No players for slot {slot}'})
                    model.Add(sum(vars_list[i] for i in eligible) == count)

            # Total player count
            model.Add(sum(vars_list) == len(slots))

            # Salary constraints
            salary_expr = sum(
                vars_list[i] * int(players[i].get('operatorSalary', 0) or 0)
                for i in range(n)
            )
            model.Add(salary_expr >= min_salary)
            model.Add(salary_expr <= max_salary)

            # Players per team max
            teams = set(p.get('team', '') for p in players)
            for team in teams:
                team_indices = [i for i, p in enumerate(players) if p.get('team') == team]
                safe_max = max(players_per_team_max, 4) if num_games <= 2 else players_per_team_max
                model.Add(sum(vars_list[i] for i in team_indices) <= safe_max)

            # Players per game max
            games = set(p.get('slateGameId') for p in players if p.get('slateGameId'))
            for game in games:
                game_indices = [i for i, p in enumerate(players) if p.get('slateGameId') == game]
                safe_game_max = max(players_per_game_max, len(slots) // max(num_games, 1) + 1)
                if num_games > 2:
                    model.Add(sum(vars_list[i] for i in game_indices) <= safe_game_max)

            # Stack constraint: sport-aware. MLB stacks a 5-hitter core (+ catcher
            # requirement); NFL stacks a QB with his own pass catchers instead.
            if current_stack and current_stack_indices:
                if is_nfl:
                    qb_indices = [
                        i for i in current_stack_indices
                        if players[i].get('operatorPosition') == 'QB'
                    ]
                    # WR/TE/RB — a same-team RB can also count toward the
                    # secondary-stack requirement (relaxed from WR/TE-only to
                    # widen the eligible pool on slates with thin WR/TE depth)
                    pass_catcher_indices = [
                        i for i in current_stack_indices
                        if players[i].get('operatorPosition') in ['WR', 'TE', 'RB']
                    ]
                    print(f"NFL Stack {current_stack}: {len(qb_indices)} QB, "
                          f"{len(pass_catcher_indices)} WR/TE/RB")

                    if qb_indices:
                        model.Add(sum(vars_list[i] for i in qb_indices) >= 1)
                        print(f"QB constraint: 1 QB from {current_stack}")

                    if len(pass_catcher_indices) >= 2:
                        model.Add(sum(vars_list[i] for i in pass_catcher_indices) >= 2)
                        print(f"Pass catcher constraint: 2+ WR/TE/RB from {current_stack}")
                    elif len(pass_catcher_indices) == 1:
                        model.Add(sum(vars_list[i] for i in pass_catcher_indices) >= 1)
                        print(f"Pass catcher constraint (relaxed): 1+ WR/TE/RB from {current_stack}")
                    else:
                        print(f"No WR/TE/RB available from {current_stack}, skipping pass-catcher constraint")

                    # Anti-correlation: never roster the opposing team's DST against this stack
                    if opposing_team:
                        opp_dst_indices = [
                            i for i in range(n)
                            if players[i].get('team') == opposing_team
                            and players[i].get('operatorPosition') in ['DST', 'DEF']
                        ]
                        for i in opp_dst_indices:
                            model.Add(vars_list[i] == 0)
                        if opp_dst_indices:
                            print(f"Anti-corr DST: blocked {len(opp_dst_indices)} from {opposing_team}")
                else:
                    # Enforce a 4-5 hitter range rather than only a lower bound —
                    # a bare ">=" let the solver treat the "stack" as a floor it
                    # could blow past or barely touch, so two lineups both
                    # "stacking" the same team could look nothing alike. Falls
                    # back to a looser >=3 (or skips entirely) when the pool is
                    # too thin for a full stack instead of forcing INFEASIBLE.
                    print(f"Stack team {current_stack}: {len(current_stack_indices)} hitters available")

                    if len(current_stack_indices) >= 4:
                        min_stack = 4
                        max_stack = min(5, len(current_stack_indices))
                        model.Add(
                            sum(vars_list[i] for i in current_stack_indices) >= min_stack
                        )
                        model.Add(
                            sum(vars_list[i] for i in current_stack_indices) <= max_stack
                        )
                        print(f"Stack constraint: {min_stack}-{max_stack} hitters from {current_stack}")
                    elif len(current_stack_indices) >= 3:
                        model.Add(
                            sum(vars_list[i] for i in current_stack_indices) >= 3
                        )
                        print(f"Stack constraint: >= 3 from {current_stack} "
                              f"(only {len(current_stack_indices)} available)")
                    else:
                        print(f"Warning: only {len(current_stack_indices)} hitters "
                              f"from {current_stack} — skipping stack")

                    # Require a catcher from the stack team; fall back to SS if no catcher available
                    stack_c_indices = [
                        i for i in current_stack_indices
                        if 'C' in (players[i].get('operatorPosition') or '').split('/')
                        or players[i].get('operatorPosition') == 'C'
                    ]
                    if len(stack_c_indices) > 0:
                        model.Add(
                            sum(vars_list[i] for i in stack_c_indices) >= 1
                        )
                        print(f"Catcher requirement: {len(stack_c_indices)} eligible catchers from {current_stack}")
                    else:
                        stack_ss_indices = [
                            i for i in current_stack_indices
                            if 'SS' in (players[i].get('operatorPosition') or '').split('/')
                            or players[i].get('operatorPosition') == 'SS'
                        ]
                        if len(stack_ss_indices) > 0:
                            model.Add(
                                sum(vars_list[i] for i in stack_ss_indices) >= 1
                            )
                            print(f"No catcher on {current_stack}, using SS fallback: {len(stack_ss_indices)} eligible")
                        else:
                            print(f"No catcher or SS available from {current_stack}, skipping that constraint")

            # Fill pool constraint: remaining hitter slots use fill pool. MLB-only —
            # for a 9-slot NFL roster this math (e.g. stack_min_size=3 reserved for
            # QB+2 catchers, forcing >=6 from "elsewhere" in the no-fill-pool
            # fallback below) leaves zero slack against the QB/pass-catcher/
            # bring-back requirements and was producing INFEASIBLE on most NFL
            # slates. NFL has no fill-pool UI today, so nothing NFL-facing relies
            # on this.
            if is_mlb:
                if fill_pool_ids and len(fill_pool_ids) > 0:
                    pitcher_slots = slots.count('P') if slots else 2
                    total_hitter_slots = len(slots) - pitcher_slots if slots else 8
                    stack_slots_used = stack_min_size if current_stack else 0
                    bring_back_slots_used = (
                        min(2, len(opposing_hitter_indices))
                        if opposing_team and opposing_hitter_indices
                        else 0
                    )
                    available_for_fill = total_hitter_slots - stack_slots_used - bring_back_slots_used

                    actual_fill_requirement = min(
                        max(1, available_for_fill),
                        len(fill_pool_hitter_indices)
                    )

                    print(f"Fill pool: {len(fill_pool_hitter_indices)} eligible | "
                          f"available slots after stack+bringback: {available_for_fill} | "
                          f"requiring: {actual_fill_requirement}")

                    if actual_fill_requirement >= 1 and len(fill_pool_hitter_indices) >= actual_fill_requirement:
                        model.Add(
                            sum(vars_list[i] for i in fill_pool_hitter_indices) >= actual_fill_requirement
                        )
                    elif actual_fill_requirement < 1:
                        print(f"Fill pool skipped: no slots available after "
                              f"stack({stack_slots_used}) + bring-back({bring_back_slots_used}) = "
                              f"{stack_slots_used + bring_back_slots_used} of {total_hitter_slots} hitter slots")
                elif current_stack:
                    pitcher_slot_count = slots.count('P')
                    hitter_slot_count = len(slots) - pitcher_slot_count
                    fill_slot_count = hitter_slot_count - stack_min_size
                    if fill_slot_count > 0:
                        model.Add(
                            sum(vars_list[i] for i in non_stack_hitter_indices) >= fill_slot_count
                        )
                        print(f"Non-stack constraint: >= {fill_slot_count} from non-stack teams")

            # Anti-correlation: block pitchers FACING the stack team, not the
            # stack team's own pitcher. The old check compared the pitcher's
            # own team to current_stack, which blocked exactly the wrong
            # pitcher — a team's own starter isn't anti-correlated with that
            # team's hitters (they're never on the field at the same time in
            # a way that makes one's success come at the other's expense);
            # the pitcher who actually conflicts with a stack is whoever the
            # stacked team is batting against, since a big offensive game
            # from the stack implies a bad one from that pitcher.
            # (MLB-only concept — pitcher_indices is always empty for NFL, so
            # this was already a no-op there; is_mlb makes that explicit)
            if is_mlb and current_stack:
                stack_game_ids = set(
                    players[j].get('slateGameId') for j in current_stack_indices
                )
                bad_pitchers = [
                    i for i in pitcher_indices
                    if players[i].get('opponent') == current_stack
                    or players[i].get('opp') == current_stack
                    or (
                        # Fallback when opponent/opp aren't populated: same
                        # game as the stack, but not on the stack's own team.
                        players[i].get('slateGameId') in stack_game_ids
                        and players[i].get('team') != current_stack
                    )
                ]
                remaining_pitchers = len(pitcher_indices) - len(bad_pitchers)
                if remaining_pitchers >= 2:
                    for i in bad_pitchers:
                        model.Add(vars_list[i] == 0)
                    print(f"Anti-correlation: blocked {len(bad_pitchers)} pitchers facing {current_stack}")
                else:
                    print(f"Anti-correlation skipped: only {remaining_pitchers} pitchers would remain")

            # Bring-back constraint: 1-2 hitters from opposing team
            if current_stack and opposing_team:
                print(f"Opposing team ({opposing_team}) hitters available: {len(opposing_hitter_indices)}")

                if len(opposing_hitter_indices) >= 1:
                    if fill_pool_ids and len(fill_pool_ids) > 0:
                        bring_back_min = 1
                        bring_back_max = 1
                        print(f"Bring-back: exactly 1 from {opposing_team} (fill pool active, preserving slots)")
                    else:
                        bring_back_min = 1
                        bring_back_max = 2
                        print(f"Bring-back: 1-2 from {opposing_team}")
                    model.Add(sum(vars_list[i] for i in opposing_hitter_indices) >= bring_back_min)
                    model.Add(sum(vars_list[i] for i in opposing_hitter_indices) <= bring_back_max)
                else:
                    print(f"No bring-back: no opposing hitters available")

            # ── NFL CLASSIC RULES ────────────────────────────
            if is_nfl and not is_showdown and nfl_classic_rules:

                # Get position indices
                qb_indices = [
                    i for i in range(n)
                    if players[i].get('operatorPosition') == 'QB'
                ]
                rb_indices = [
                    i for i in range(n)
                    if players[i].get('operatorPosition') == 'RB'
                ]
                wr_te_indices = [
                    i for i in range(n)
                    if players[i].get('operatorPosition') in ['WR', 'TE']
                ]
                dst_indices = [
                    i for i in range(n)
                    if players[i].get('operatorPosition') in ['DST', 'DEF']
                ]

                # ── RULE: qb_stack ───────────────────────────
                # QB + 2 pass catchers from same team
                if 'qb_stack' in nfl_classic_rules and current_stack:
                    stack_qb = [
                        i for i in qb_indices
                        if players[i].get('team') == current_stack
                    ]
                    stack_pass_catchers = [
                        i for i in range(n)
                        if players[i].get('team') == current_stack
                        and players[i].get('operatorPosition') in ['WR', 'TE']
                    ]
                    if stack_qb:
                        model.Add(
                            sum(vars_list[i] for i in stack_qb) >= 1
                        )
                        print(f"qb_stack: QB from {current_stack}")
                    if len(stack_pass_catchers) >= 2:
                        model.Add(
                            sum(vars_list[i] for i in stack_pass_catchers) >= 2
                        )
                        print(f"qb_stack: 2+ WR/TE from {current_stack}")

                # ── RULE: bring_back ─────────────────────────
                # 1 WR/TE/RB from opposing team
                if 'bring_back' in nfl_classic_rules and opposing_team:
                    opp_skill = [
                        i for i in range(n)
                        if players[i].get('team') == opposing_team
                        and players[i].get('operatorPosition') in ['WR', 'TE', 'RB']
                    ]
                    if opp_skill:
                        model.Add(
                            sum(vars_list[i] for i in opp_skill) >= 1
                        )
                        print(f"bring_back: 1+ skill from {opposing_team}")

                # ── RULE: no_dst_vs_stack ────────────────────
                # Block DST that faces the stack team
                if 'no_dst_vs_stack' in nfl_classic_rules and current_stack:
                    bad_dst = [
                        i for i in dst_indices
                        if players[i].get('opponent') == current_stack
                        or players[i].get('opp') == current_stack
                    ]
                    for i in bad_dst:
                        model.Add(vars_list[i] == 0)
                    if bad_dst:
                        print(f"no_dst_vs_stack: blocked {len(bad_dst)} DST")

                # ── RULE: min_one_low_own ────────────────────
                # At least 1 player under 15% ownership
                if 'min_one_low_own' in nfl_classic_rules:
                    low_own = [
                        i for i in range(n)
                        if float(players[i].get('ownershipProjection') or 0) < 15
                    ]
                    if low_own:
                        model.Add(
                            sum(vars_list[i] for i in low_own) >= 1
                        )
                        print(f"min_one_low_own: {len(low_own)} eligible")

                # ── RULE: max_player_own ─────────────────────
                # Exclude players over 35% ownership
                if 'max_player_own' in nfl_classic_rules:
                    high_own = [
                        i for i in range(n)
                        if float(players[i].get('ownershipProjection') or 0) > 35
                    ]
                    blocked = 0
                    for i in high_own:
                        # Don't block locked players — normalize_id() here,
                        # not a plain str(), so this matches locked_player_ids
                        # the same way every other lock-check in this file does
                        # (see the "non-normalized" note near locked_indices above).
                        if normalize_id(players[i].get('slatePlayerId')) not in locked_player_ids:
                            model.Add(vars_list[i] == 0)
                            blocked += 1
                    if blocked:
                        print(f"max_player_own: blocked {blocked} players over 35% own")

                # ── RULE: must_have_rb ───────────────────────
                # At least 1 RB in every lineup
                if 'must_have_rb' in nfl_classic_rules:
                    if rb_indices:
                        model.Add(
                            sum(vars_list[i] for i in rb_indices) >= 1
                        )
                        print(f"must_have_rb: >= 1 RB required")

                # ── RULE: two_rb ─────────────────────────────
                # At least 2 RBs in every lineup
                if 'two_rb' in nfl_classic_rules:
                    if len(rb_indices) >= 2:
                        model.Add(
                            sum(vars_list[i] for i in rb_indices) >= 2
                        )
                        print(f"two_rb: >= 2 RBs required")

                # ── RULE: salary_floor ───────────────────────
                # Must use at least $49,700
                if 'salary_floor' in nfl_classic_rules:
                    salary_expr = sum(
                        vars_list[i] * int(players[i].get('operatorSalary', 0) or 0)
                        for i in range(n)
                    )
                    model.Add(salary_expr >= 49700)
                    print(f"salary_floor: >= $49,700 required")

            # Diversity constraint — look back at ALL previous lineups not
            # just 20, and enforce stronger uniqueness
            lookback = min(len(previous_lineups), 50)
            for prev in previous_lineups[-lookback:]:
                overlap_allowed = max(
                    len(slots) - max(min_unique, 3),
                    len(slots) - 5
                )
                model.Add(sum(vars_list[i] for i in prev) <= overlap_allowed)

            # Objective: maximize GPP score with secondary hitter boost and value weighting.
            # The three boosts below (secondary/bring-back/value) were tuned around
            # MLB's 5-hitter-stack shape and its "secondary stack" concept — kept
            # MLB-only (is_mlb) rather than reused as-is for NFL's different roster
            # shape; NFL lineups score on gpp_score + usage penalty + noise only.
            objective_terms = []
            for i in range(n):
                base_score = int((players[i].get('gpp_score', 0) or 0) * 100)
                usage_penalty = player_usage_count.get(i, 0) * 25
                random_noise = random.randint(-20, 20)
                secondary_boost = 0
                bring_back_boost = 0
                value_boost = 0

                if is_mlb:
                    # Strongly prefer the single best non-stack hitter in remaining slots
                    if (current_stack and
                            best_secondary_idx is not None and
                            i == best_secondary_idx):
                        secondary_boost = 500

                    # Prefer high-projection opposing team hitters for game-stack correlation
                    if (opposing_team and
                            players[i].get('team') == opposing_team and
                            players[i].get('operatorPosition') not in ['SP', 'RP']):
                        proj = float(players[i].get('projectedPoints') or 0)
                        bring_back_boost = int(proj * 15)

                    # For other non-stack/non-bring-back hitters, weight by points-per-dollar
                    if (current_stack and
                            players[i].get('team') != current_stack and
                            players[i].get('team') != opposing_team and
                            i != best_secondary_idx):
                        salary = float(players[i].get('operatorSalary') or 1)
                        proj = float(players[i].get('projectedPoints') or 0)
                        if salary > 0:
                            value_per_k = (proj / salary) * 1000
                            value_boost = int(value_per_k * 20)

                adjusted_score = max(
                    base_score - usage_penalty + random_noise + secondary_boost + bring_back_boost + value_boost,
                    1
                )
                objective_terms.append(vars_list[i] * adjusted_score)
            model.Maximize(sum(objective_terms))

            # Pre-solve feasibility check
            print(f"\n--- Pre-solve diagnostics (lineup {lineup_num+1}) ---")
            print(f"Stack: {current_stack} ({len(current_stack_indices)} hitters)")
            print(f"Opposing: {opposing_team} ({len(opposing_hitter_indices)} hitters)")
            print(f"Pitcher pool: {len(pitcher_indices)}")

            min_possible = 0
            max_possible = 0

            pitcher_salaries = sorted([
                int(players[i].get('operatorSalary', 0))
                for i in pitcher_indices
            ])
            if len(pitcher_salaries) >= 2:
                min_possible += pitcher_salaries[0] + pitcher_salaries[1]
                max_possible += pitcher_salaries[-1] + pitcher_salaries[-2]

            slot_counts_check = {}
            for slot in slots:
                if slot != 'P':
                    slot_counts_check[slot] = slot_counts_check.get(slot, 0) + 1

            for slot, count in slot_counts_check.items():
                eligible = [
                    int(players[i].get('operatorSalary', 0))
                    for i in hitter_indices
                    if player_fits_slot(players[i], slot)
                ]
                eligible.sort()
                if len(eligible) >= count:
                    min_possible += sum(eligible[:count])
                    max_possible += sum(eligible[-count:])
                else:
                    print(f"!! FATAL: only {len(eligible)} eligible for slot {slot}, need {count}")

            print(f"Salary feasibility: ${min_possible:,} - ${max_possible:,} "
                  f"vs required ${min_salary:,} - ${max_salary:,}")
            if min_possible > max_salary:
                print(f"!! INFEASIBLE: cheapest lineup ${min_possible:,} exceeds cap ${max_salary:,}")
            if max_possible < min_salary:
                print(f"!! INFEASIBLE: most expensive lineup ${max_possible:,} below minimum ${min_salary:,}")

            if current_stack:
                print(f"Stack hitters available: {len(current_stack_indices)}")
                if len(current_stack_indices) < stack_min_size:
                    print(f"!! INFEASIBLE: only {len(current_stack_indices)} from {current_stack}, need {stack_min_size}")
                if is_nfl:
                    stack_qb = [i for i in current_stack_indices if players[i].get('operatorPosition') == 'QB']
                    stack_pc = [i for i in current_stack_indices if players[i].get('operatorPosition') in ['WR', 'TE']]
                    print(f"Stack QB: {len(stack_qb)} | Stack WR/TE: {len(stack_pc)}")
                    if not stack_qb:
                        print(f"!! WARN: no QB from {current_stack}")
                    if not stack_pc:
                        print(f"!! WARN: no WR/TE from {current_stack}")
                else:
                    stack_c = [
                        i for i in current_stack_indices
                        if 'C' in (players[i].get('operatorPosition') or '').split('/')
                        or players[i].get('operatorPosition') == 'C'
                    ]
                    print(f"Stack catchers: {len(stack_c)}")
                    if len(stack_c) == 0:
                        stack_ss = [
                            i for i in current_stack_indices
                            if players[i].get('operatorPosition') == 'SS'
                        ]
                        print(f"Stack SS (fallback): {len(stack_ss)}")
                        if len(stack_ss) == 0:
                            print(f"!! WARN: no C or SS from {current_stack}")

            if opposing_team:
                print(f"Bring-back {'pass catchers' if is_nfl else 'hitters'}: {len(opposing_hitter_indices)}")
                if len(opposing_hitter_indices) < 1:
                    print(f"!! WARN: no opposing {'pass catchers' if is_nfl else 'hitters'} for bring-back")

            # This diagnostic estimates how many slots are "spoken for" by the
            # stack/bring-back requirements vs. left open for everyone else.
            # NFL no longer forces an exact partition here (see the fill-pool/
            # non-stack fallback above, which is MLB-only), so there's nothing
            # meaningful to subtract — report the full slot count instead of a
            # stale MLB-shaped estimate that would falsely flag INFEASIBLE.
            if is_nfl:
                hitter_slots_total = len(slots)
                stack_slots = 0
                bring_back_slots = 0
            else:
                hitter_slots_total = len([s for s in slots if s != 'P'])
                stack_slots = stack_min_size if current_stack else 0
                bring_back_slots = (
                    min(2, len(opposing_hitter_indices))
                    if opposing_team and opposing_hitter_indices
                    else 0
                )
            remaining_slots = hitter_slots_total - stack_slots - bring_back_slots
            remaining_hitters = len([
                i for i in hitter_indices
                if players[i].get('team') != current_stack
                and players[i].get('team') != opposing_team
            ])
            print(f"Hitter slots: {hitter_slots_total} total | {stack_slots} stack | "
                  f"{bring_back_slots} bring-back | {remaining_slots} remaining")
            print(f"Remaining hitter pool: {remaining_hitters} players")
            if remaining_hitters < remaining_slots:
                print(f"!! INFEASIBLE: only {remaining_hitters} hitters for {remaining_slots} remaining slots")
            print(f"--- End diagnostics ---\n")

            status = solver_obj.Solve(model)

            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                selected_indices = [i for i in range(n) if solver_obj.Value(vars_list[i])]
                lineup_key = tuple(sorted(selected_indices))

                if lineup_key in seen_lineups:
                    consecutive_failures += 1
                    print(f"Duplicate lineup detected — skipping")
                    continue

                seen_lineups.add(lineup_key)
                previous_lineups.append(selected_indices)

                lineup_players = [players[i] for i in selected_indices]
                total_salary = sum(p.get('operatorSalary', 0) or 0 for p in lineup_players)
                total_proj = sum(p.get('projectedPoints', 0) or 0 for p in lineup_players)

                all_lineups.append({
                    'players': lineup_players,
                    'totalSalary': total_salary,
                    'projectedPoints': round(total_proj, 2)
                })
                lineup_num += 1
                consecutive_failures = 0
                for idx in selected_indices:
                    player_usage_count[idx] = player_usage_count.get(idx, 0) + 1
                if is_mlb and current_stack:
                    stack_team_usage[current_stack] = stack_team_usage.get(current_stack, 0) + 1

                # Track QB usage specifically for NFL — diagnostic only, the
                # actual deprioritization already happens via usage_penalty
                # in the objective above; this just surfaces when a QB is
                # dominating the batch despite that penalty.
                if is_nfl and not is_showdown:
                    lineup_qbs = [
                        idx for idx in selected_indices
                        if players[idx].get('operatorPosition') == 'QB'
                    ]
                    for qb_idx in lineup_qbs:
                        qb = players[qb_idx]
                        qb_usage = player_usage_count.get(qb_idx, 0)
                        # If a QB has been used in more than
                        # 60% of lineups so far, boost penalty
                        if lineup_num > 0:
                            qb_pct = qb_usage / lineup_num
                            if qb_pct > 0.6:
                                print(f"QB {qb.get('operatorPlayerName')} "
                                      f"overused ({qb_pct:.0%}) — "
                                      f"increasing penalty")

                # Hard cap: no player in more than 80% of lineups unless
                # they are locked. No hard constraint is added here — the
                # model for this lineup is already solved — this is handled
                # by usage_penalty in the objective for subsequent lineups.
                if lineup_num >= 3:
                    for i in range(n):
                        pid = str(players[i].get('slatePlayerId', ''))
                        usage = player_usage_count.get(i, 0)
                        usage_pct = usage / lineup_num if lineup_num > 0 else 0
                        is_locked = pid in locked_player_ids
                        if usage_pct > 0.80 and not is_locked:
                            pass  # handled by usage_penalty above

                print(f"  ✓ Lineup {lineup_num} accepted with stack: {current_stack}")
            else:
                print(f"INFEASIBLE: status={solver_obj.StatusName(status)}")
                consecutive_failures += 1

                if consecutive_failures > 5 and opposing_team:
                    print(f"Too many failures - disabling bring-back for next attempt")
                    opposing_team = None

        print(f"Generation complete: {lineup_num}/{num_lineups} lineups in {attempt} attempts "
              f"({consecutive_failures} consecutive failures at end)")
        if lineup_num < num_lineups:
            print(f"WARNING: Could not reach requested count. "
                  f"This usually means the player pool is too restrictive "
                  f"(stack + fill pool + exclusions leave too few valid combinations).")

        # ─── POST-GENERATION EXPOSURE REBALANCE ─────────────────
        # Skip rebalance for showdown — CPT/FLEX dual IDs cause circular
        # swap corruption. Showdown has its own captain-exclusivity and
        # slot-count invariants (enforced at solve time above) that this
        # generic swap-based rebalance knows nothing about — it would
        # cheerfully swap a lineup's only CPT for someone's FLEX entry.
        if ownership_targets and all_lineups and not is_showdown:
            total_lineups = len(all_lineups)
            print(f"\n=== EXPOSURE REBALANCE (target vs actual) ===")
            print(f"Total lineups to rebalance: {total_lineups}")
            print(f"Player pool size: {len(players)}")

            player_by_id = {}
            for p in players:
                pid = p.get('slatePlayerId')
                if pid is not None:
                    player_by_id[str(pid)] = p
                    player_by_id[str(int(float(str(pid))))] = p
            print(f"player_by_id keys sample: {list(player_by_id.keys())[:8]}")

            def get_exposure(lineups, player_id):
                pid = str(player_id)
                count = sum(
                    1 for lu in lineups
                    if any(str(p.get('slatePlayerId')) == pid for p in lu.get('players', []))
                )
                return count / len(lineups) * 100 if lineups else 0

            def pos_compatible(pos_a, pos_b):
                def slots(pos):
                    parts = pos.upper().split('/')
                    result = set(parts)
                    if 'SP' in result or 'RP' in result:
                        result.add('P')
                    return result
                return bool(slots(pos_a) & slots(pos_b))

            # Track players added/removed within THIS rebalance pass so one
            # player's fix can't immediately undo another's: without this, a
            # player swapped in to satisfy one target could get picked right
            # back out as a "replacement" for a different target's removal
            # (or vice versa), quietly overshooting both targets in a way
            # that looks like players ping-ponging between lineups.
            recently_added = set()
            recently_removed = set()

            for pid_str, target_pct in ownership_targets.items():
                target_pct = float(target_pct)
                if target_pct <= 0:
                    continue

                current_pct = get_exposure(all_lineups, pid_str)
                target_count = round(target_pct / 100 * total_lineups)
                # For very small lineup sets, round() alone rounds too
                # aggressively (e.g. a 20% target with 3 lineups rounds up to
                # "1 of 3" = 33%) — treat sub-one-lineup targets as 0 instead.
                if total_lineups <= 5:
                    # With few lineups ownership targets are approximate —
                    # don't try to force exact counts
                    if target_pct < (100 / total_lineups):
                        target_count = 0
                    elif target_pct >= (100 / total_lineups):
                        target_count = max(0, min(target_count, total_lineups))
                current_count = round(current_pct / 100 * total_lineups)

                print(f"\n--- Player {pid_str} ---")
                print(f"  Name: {player_by_id.get(pid_str, {}).get('operatorPlayerName', 'NOT FOUND')}")
                print(f"  Target: {target_pct}% = {target_count} lineups")
                print(f"  Current: {current_pct:.1f}% = {current_count} lineups")

                target_player_check = player_by_id.get(pid_str) or player_by_id.get(str(int(float(pid_str))))
                if not target_player_check:
                    print(f"  !! Player {pid_str} NOT FOUND in player_by_id")
                    print(f"  Available IDs sample: {list(player_by_id.keys())[:5]}")
                    continue
                else:
                    print(f"  Player found: {target_player_check.get('operatorPlayerName')} "
                          f"pos={target_player_check.get('operatorPosition')} "
                          f"team={target_player_check.get('team')} "
                          f"salary=${target_player_check.get('operatorSalary')}")

                print(f"Player {pid_str}: target={target_pct}% ({target_count} lineups), "
                      f"actual={current_pct:.1f}% ({current_count} lineups)")

                if current_count < target_count:
                    needed = target_count - current_count
                    print(f"  → Need to ADD to {needed} more lineups")

                    target_player = player_by_id.get(pid_str)
                    if not target_player:
                        print(f"  !! Target player {pid_str} not found, skipping")
                        continue

                    target_pos = target_player.get('operatorPosition', '')
                    target_salary = int(target_player.get('operatorSalary', 0))

                    def pos_compatible(pos_a, pos_b):
                        def get_slots(pos):
                            parts = str(pos).upper().split('/')
                            result = set(parts)
                            if 'SP' in result or 'RP' in result:
                                result.add('P')
                            return result
                        return bool(get_slots(pos_a) & get_slots(pos_b))

                    lineups_without = [
                        i for i, lu in enumerate(all_lineups)
                        if not any(
                            str(p.get('slatePlayerId')) == pid_str
                            for p in lu.get('players', [])
                        )
                    ]
                    random.shuffle(lineups_without)
                    added = 0

                    for lu_idx in lineups_without:
                        if added >= needed:
                            break

                        lu = all_lineups[lu_idx]
                        lu_players = lu.get('players', [])
                        current_salary = sum(
                            int(player_by_id.get(
                                str(p.get('slatePlayerId')), {}
                            ).get('operatorSalary', 0))
                            for p in lu_players
                        )

                        team_counts = {}
                        for lp in lu_players:
                            lp_data = player_by_id.get(str(lp.get('slatePlayerId')), {})
                            t = lp_data.get('team', '')
                            if t:
                                team_counts[t] = team_counts.get(t, 0) + 1
                        stack_team_lu = max(team_counts, key=team_counts.get) if team_counts else None
                        stack_count = team_counts.get(stack_team_lu, 0) if stack_team_lu else 0

                        print(f"  Lineup {lu_idx+1}: stack={stack_team_lu}({stack_count}), salary=${current_salary}")

                        # Strategy 1: same-position non-stack player swap
                        swap_found = False
                        for p in lu_players:
                            p_id = str(p.get('slatePlayerId'))
                            p_data = player_by_id.get(p_id, {})
                            p_pos = p_data.get('operatorPosition', '')
                            p_team = p_data.get('team', '')
                            p_salary = int(p_data.get('operatorSalary', 0))

                            if p_id == pid_str:
                                continue
                            # Skip if this candidate was just removed in this
                            # rebalance pass (prevents circular swaps)
                            if p_id in recently_removed:
                                continue
                            if not pos_compatible(target_pos, p_pos):
                                continue
                            if (stack_team_lu and p_team == stack_team_lu and stack_count <= 5):
                                print(f"    Strategy1 SKIP {p_id} ({p_data.get('operatorPlayerName')}): stack player")
                                continue

                            new_salary = current_salary - p_salary + target_salary
                            if new_salary < min_salary - 2000 or new_salary > max_salary + 200:
                                print(f"    Strategy1 SKIP {p_id}: salary ${new_salary} out of range")
                                continue

                            all_lineups[lu_idx]['players'] = [
                                {'slatePlayerId': int(pid_str), 'slot': p.get('slot', target_pos)}
                                if str(pp.get('slatePlayerId')) == p_id else pp
                                for pp in lu_players
                            ]
                            added += 1
                            recently_added.add(pid_str)
                            swap_found = True
                            print(f"    Strategy1 SWAP: {p_data.get('operatorPlayerName')} → {target_player.get('operatorPlayerName')} salary ${current_salary} → ${new_salary}")
                            break

                        if swap_found:
                            continue

                        # Strategy 2: stack has >5 players, swap weakest same-position stack player
                        if stack_count > 5:
                            print(f"    Strategy2: stack has {stack_count} players, looking for excess to remove")
                            stack_players_same_pos = [
                                p for p in lu_players
                                if (str(p.get('slatePlayerId')) not in recently_removed
                                    and player_by_id.get(str(p.get('slatePlayerId')), {}).get('team') == stack_team_lu
                                    and pos_compatible(
                                        target_pos,
                                        player_by_id.get(str(p.get('slatePlayerId')), {}).get('operatorPosition', '')
                                    ))
                            ]
                            if stack_players_same_pos:
                                stack_players_same_pos.sort(
                                    key=lambda p: float(
                                        player_by_id.get(str(p.get('slatePlayerId')), {}).get('projectedPoints', 0) or 0
                                    )
                                )
                                weakest = stack_players_same_pos[0]
                                w_id = str(weakest.get('slatePlayerId'))
                                w_data = player_by_id.get(w_id, {})
                                w_salary = int(w_data.get('operatorSalary', 0))
                                new_salary = current_salary - w_salary + target_salary
                                if min_salary - 2000 <= new_salary <= max_salary + 200:
                                    all_lineups[lu_idx]['players'] = [
                                        {'slatePlayerId': int(pid_str), 'slot': weakest.get('slot', target_pos)}
                                        if str(pp.get('slatePlayerId')) == w_id else pp
                                        for pp in lu_players
                                    ]
                                    added += 1
                                    recently_added.add(pid_str)
                                    swap_found = True
                                    print(f"    Strategy2 SWAP: {w_data.get('operatorPlayerName')} → {target_player.get('operatorPlayerName')}")

                        if not swap_found:
                            # Strategy 3: last resort — any non-stack, non-pitcher player
                            print(f"    Strategy3: last resort any non-stack swap")
                            for p in lu_players:
                                p_id = str(p.get('slatePlayerId'))
                                p_data = player_by_id.get(p_id, {})
                                p_team = p_data.get('team', '')
                                p_salary = int(p_data.get('operatorSalary', 0))
                                p_pos = p_data.get('operatorPosition', '')

                                if p_id == pid_str:
                                    continue
                                # Skip if this candidate was just removed in
                                # this rebalance pass (prevents circular swaps)
                                if p_id in recently_removed:
                                    continue
                                if p_pos in ['SP', 'RP']:
                                    continue
                                if (stack_team_lu and p_team == stack_team_lu and stack_count <= 5):
                                    continue

                                new_salary = current_salary - p_salary + target_salary
                                if new_salary < min_salary - 2000 or new_salary > max_salary + 200:
                                    continue

                                all_lineups[lu_idx]['players'] = [
                                    {'slatePlayerId': int(pid_str), 'slot': target_pos}
                                    if str(pp.get('slatePlayerId')) == p_id else pp
                                    for pp in lu_players
                                ]
                                added += 1
                                recently_added.add(pid_str)
                                swap_found = True
                                print(f"    Strategy3 SWAP: {p_data.get('operatorPlayerName')} ({p_pos}) → {target_player.get('operatorPlayerName')} ({target_pos})")
                                break

                        if not swap_found:
                            print(f"    ALL strategies failed for lineup {lu_idx+1}")

                    print(f"  Added to {added}/{needed} lineups")

                elif current_count > target_count:
                    excess = current_count - target_count
                    print(f"  → Need to REMOVE from {excess} lineups")

                    lineups_with = [
                        i for i, lu in enumerate(all_lineups)
                        if any(str(p.get('slatePlayerId')) == pid_str for p in lu.get('players', []))
                    ]
                    random.shuffle(lineups_with)
                    removed = 0

                    for lu_idx in lineups_with:
                        if removed >= excess:
                            break
                        lu = all_lineups[lu_idx]
                        lu_players = lu.get('players', [])
                        current_salary = sum(
                            player_by_id.get(str(p.get('slatePlayerId')), {}).get('operatorSalary', 0)
                            for p in lu_players
                        )
                        target_player = player_by_id.get(pid_str)
                        if not target_player:
                            break
                        target_salary = target_player.get('operatorSalary', 0)
                        target_pos = target_player.get('operatorPosition', '')
                        used_ids = {str(p.get('slatePlayerId')) for p in lu_players}
                        replacement = None

                        for cand in players:
                            cand_id = str(cand.get('slatePlayerId'))
                            if cand_id in used_ids or cand_id == pid_str:
                                continue
                            # Skip if this replacement was just added in this
                            # rebalance pass (prevents circular swaps)
                            if cand_id in recently_added:
                                continue
                            if not pos_compatible(target_pos, cand.get('operatorPosition', '')):
                                continue
                            new_salary = current_salary - target_salary + cand.get('operatorSalary', 0)
                            if new_salary < min_salary - 1000 or new_salary > max_salary:
                                continue
                            replacement = cand
                            break

                        if replacement:
                            rep_id = str(replacement.get('slatePlayerId'))
                            slot_to_swap = next(
                                (p.get('slot') for p in lu_players if str(p.get('slatePlayerId')) == pid_str),
                                'OF'
                            )
                            all_lineups[lu_idx]['players'] = [
                                {'slatePlayerId': int(rep_id), 'slot': slot_to_swap}
                                if str(p.get('slatePlayerId')) == pid_str else p
                                for p in lu_players
                            ]
                            removed += 1
                            recently_removed.add(pid_str)
                            print(f"  Removed {pid_str} → {rep_id} in lineup {lu_idx + 1}")

                    print(f"  Removed from {removed} lineups")

            print(f"=== REBALANCE COMPLETE ===\n")
        # ─── END REBALANCE ───────────────────────────────────────

        # Compute updated global exposure counts for the caller
        updated_exposure = dict(global_exposure_actual)
        for lu in all_lineups:
            for p in lu.get('players', []):
                pid = str(p.get('slatePlayerId', ''))
                if pid:
                    updated_exposure[pid] = updated_exposure.get(pid, 0) + 1

        if not all_lineups:
            return jsonify({
                'success': False,
                'error': 'Could not generate lineups. Try relaxing your rules.'
            })

        # Fill pool: ensure each fill pool player appears in at least one lineup
        if fill_pool_ids:
            used_fill_ids = set(
                p['slatePlayerId']
                for lu in all_lineups
                for p in lu['players']
                if p['slatePlayerId'] in fill_pool_ids
            )
            missing_fill = [i for i, p in enumerate(players) if p['slatePlayerId'] in fill_pool_ids and p['slatePlayerId'] not in used_fill_ids]
            for fill_idx in missing_fill:
                model = cp_model.CpModel()
                vars_list = [model.NewBoolVar(f'p_{i}') for i in range(n)]
                model.Add(vars_list[fill_idx] == 1)
                for i, p in enumerate(players):
                    if p['locked']:
                        model.Add(vars_list[i] == 1)
                slot_counts = {}
                for slot in slots:
                    slot_counts[slot] = slot_counts.get(slot, 0) + 1
                for slot, count in slot_counts.items():
                    eligible = [i for i, p in enumerate(players) if player_fits_slot(p, slot)]
                    if eligible:
                        model.Add(sum(vars_list[i] for i in eligible) == count)
                model.Add(sum(vars_list) == len(slots))
                salary_expr = sum(vars_list[i] * int(players[i].get('operatorSalary', 0) or 0) for i in range(n))
                model.Add(salary_expr >= min_salary)
                model.Add(salary_expr <= max_salary)
                teams = set(p.get('team', '') for p in players)
                for team in teams:
                    team_indices = [i for i, p in enumerate(players) if p.get('team') == team]
                    safe_max = max(players_per_team_max, 4) if num_games <= 2 else players_per_team_max
                    model.Add(sum(vars_list[i] for i in team_indices) <= safe_max)
                objective = sum(vars_list[i] * int((players[i].get('gpp_score', 0) or 0) * 100) for i in range(n))
                model.Maximize(objective)
                status = solver_obj.Solve(model)
                if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    selected_indices = [i for i in range(n) if solver_obj.Value(vars_list[i])]
                    lineup_key = tuple(sorted(selected_indices))
                    if lineup_key not in seen_lineups:
                        seen_lineups.add(lineup_key)
                        lineup_players = [players[i] for i in selected_indices]
                        total_salary = sum(p.get('operatorSalary', 0) or 0 for p in lineup_players)
                        total_proj = sum(p.get('projectedPoints', 0) or 0 for p in lineup_players)
                        all_lineups.append({
                            'players': lineup_players,
                            'totalSalary': total_salary,
                            'projectedPoints': round(total_proj, 2)
                        })

        return jsonify({
            'success': True,
            'lineups': all_lineups,
            'generated': len(all_lineups),
            'updatedExposure': updated_exposure,
        })

    except Exception as e:
        import traceback
        print(f"EXCEPTION IN OPTIMIZE:")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV', 'production') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)