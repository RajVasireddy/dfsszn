import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model

app = Flask(__name__)
CORS(app)

SOLVER_TIME_LIMIT = 5.0

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

@app.route('/optimize', methods=['POST'])
def optimize():
    try:
        body = request.json
        players = body.get('players', [])
        slots = body.get('slots', [])

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

        lineup_num = 0
        attempt = 0
        max_attempts = num_lineups * 40
        player_usage_count = {}
        consecutive_failures = 0
        max_consecutive_failures = 100

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

            model = cp_model.CpModel()
            vars_list = [model.NewBoolVar(f'p_{i}') for i in range(n)]

            # Lock required players
            for i, p in enumerate(players):
                if p['locked']:
                    model.Add(vars_list[i] == 1)

            # Separate pitchers and hitters
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

            # Stack-dependent index lists (recalculated each lineup after opposing_team is resolved)
            current_stack_indices = [
                i for i in hitter_indices
                if players[i].get('team') == current_stack
            ] if current_stack else []

            opposing_hitter_indices = [
                i for i in hitter_indices
                if players[i].get('team') == opposing_team
            ] if opposing_team else []

            non_stack_non_opp_indices = [
                i for i in hitter_indices
                if players[i].get('team') != current_stack
                and players[i].get('team') != opposing_team
            ] if current_stack else hitter_indices

            if non_stack_non_opp_indices:
                best_secondary_idx = max(
                    non_stack_non_opp_indices,
                    key=lambda i: float(players[i].get('projectedPoints') or 0)
                )
            else:
                best_secondary_idx = None

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

            # Stack constraint: >= stack_team_size hitters from current stack team
            if current_stack and current_stack_indices:
                actual_stack_size = min(
                    stack_team_size if stack_team_size > 0 else 5,
                    len(current_stack_indices)
                )
                model.Add(
                    sum(vars_list[i] for i in current_stack_indices) >= actual_stack_size
                )
                print(f"Stack constraint: >= {actual_stack_size} from {current_stack}")

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

            # Fill pool constraint: remaining hitter slots use fill pool
            if fill_pool_ids and len(fill_pool_ids) > 0:
                pitcher_slots = slots.count('P') if slots else 2
                total_hitter_slots = len(slots) - pitcher_slots if slots else 8
                stack_slots_used = 5 if current_stack else 0
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
                fill_slot_count = hitter_slot_count - 5
                if fill_slot_count > 0:
                    model.Add(
                        sum(vars_list[i] for i in non_stack_hitter_indices) >= fill_slot_count
                    )
                    print(f"Non-stack constraint: >= {fill_slot_count} from non-stack teams")

            # Anti-correlation: pitchers should not pitch against current stack team
            if current_stack:
                bad_pitcher_indices = [
                    i for i in pitcher_indices
                    if players[i].get('team') == current_stack
                ]
                remaining_pitchers = len(pitcher_indices) - len(bad_pitcher_indices)
                if remaining_pitchers >= 2:
                    for i in bad_pitcher_indices:
                        model.Add(vars_list[i] == 0)
                    print(f"Anti-correlation: blocked {len(bad_pitcher_indices)} pitchers from {current_stack}")

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

            # Diversity constraint
            for prev in previous_lineups[-20:]:
                model.Add(sum(vars_list[i] for i in prev) <= len(slots) - min_unique)

            # Objective: maximize GPP score with secondary hitter boost and value weighting
            objective_terms = []
            for i in range(n):
                base_score = int((players[i].get('gpp_score', 0) or 0) * 100)
                usage_penalty = player_usage_count.get(i, 0) * 15
                random_noise = random.randint(-8, 8)

                # Strongly prefer the single best non-stack hitter in remaining slots
                secondary_boost = 0
                if (current_stack and
                        best_secondary_idx is not None and
                        i == best_secondary_idx):
                    secondary_boost = 500

                # Prefer high-projection opposing team hitters for game-stack correlation
                bring_back_boost = 0
                if (opposing_team and
                        players[i].get('team') == opposing_team and
                        players[i].get('operatorPosition') not in ['SP', 'RP']):
                    proj = float(players[i].get('projectedPoints') or 0)
                    bring_back_boost = int(proj * 15)

                # For other non-stack/non-bring-back hitters, weight by points-per-dollar
                value_boost = 0
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
                if len(current_stack_indices) < 5:
                    print(f"!! INFEASIBLE: only {len(current_stack_indices)} hitters from {current_stack}, need 5")
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
                print(f"Bring-back hitters: {len(opposing_hitter_indices)}")
                if len(opposing_hitter_indices) < 1:
                    print(f"!! WARN: no opposing hitters for bring-back")

            hitter_slots_total = len([s for s in slots if s != 'P'])
            stack_slots = 5
            bring_back_slots = min(2, len(opposing_hitter_indices))
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
        if ownership_targets and all_lineups:
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

            for pid_str, target_pct in ownership_targets.items():
                target_pct = float(target_pct)
                if target_pct <= 0:
                    continue

                current_pct = get_exposure(all_lineups, pid_str)
                target_count = round(target_pct / 100 * total_lineups)
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
                                if (player_by_id.get(str(p.get('slatePlayerId')), {}).get('team') == stack_team_lu
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
                            print(f"  Removed {pid_str} → {rep_id} in lineup {lu_idx + 1}")

                    print(f"  Removed from {removed} lineups")

            print(f"=== REBALANCE COMPLETE ===\n")
        # ─── END REBALANCE ───────────────────────────────────────

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
            'generated': len(all_lineups)
        })

    except Exception as e:
        import traceback
        print(f"EXCEPTION IN OPTIMIZE:")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(port=5001, debug=True)