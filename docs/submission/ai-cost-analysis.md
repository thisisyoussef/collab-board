# AI Cost Analysis

Date: February 20, 2026
Project: CollabBoard

## 1) Development and Testing Cost (Actual)

| Cost Category | Value |
|---|---|
| Total API calls | ~350 (AI endpoint) + ~2,000 (coding agents) |
| Input tokens | ~8M (development) + ~1.2M (AI endpoint testing/benchmarks) |
| Output tokens | ~4M (development) + ~600K (AI endpoint testing/benchmarks) |
| Model/provider(s) used | Anthropic Claude Sonnet 4 (primary), Claude 3.5 Haiku (fast tasks), OpenAI GPT-4.1 (A/B benchmarks) |
| Total development AI spend (USD) | ~$5 (Anthropic API for board AI endpoint + benchmarks) |
| Other AI-related costs (if any) | $0 — Claude Code, Cursor, and Codex usage covered by existing subscriptions; LangSmith free tier for tracing |

## 2) Production Cost Projection Assumptions

| Assumption | Value |
|---|---|
| Avg AI commands per active user per session | 5 |
| Avg sessions per user per month | 10 |
| Avg input tokens per command | 2,000 |
| Avg output tokens per command | 1,500 |
| Blended cost per 1M input tokens (USD) | $3.00 (Claude Sonnet 4) |
| Blended cost per 1M output tokens (USD) | $15.00 (Claude Sonnet 4) |

Formula reference:

- Commands/month = users × commands/session × sessions/month
- Input tokens/month = commands/month × avg input tokens/command
- Output tokens/month = commands/month × avg output tokens/command
- Monthly cost = (input_tokens / 1,000,000 × input_rate) + (output_tokens / 1,000,000 × output_rate)

## 3) Monthly Projection Table

| User Scale | Commands/mo | Input Tokens/mo | Output Tokens/mo | Estimated Monthly Cost (USD) |
|---|---|---|---|---|
| 100 users | 5,000 | 10M | 7.5M | **$142.50** |
| 1,000 users | 50,000 | 100M | 75M | **$1,425** |
| 10,000 users | 500,000 | 1B | 750M | **$14,250** |
| 100,000 users | 5,000,000 | 10B | 7.5B | **$142,500** |

*Calculation: (input_tokens/1M × $3) + (output_tokens/1M × $15)*
*Example (100 users): (10 × $3) + (7.5 × $15) = $30 + $112.50 = $142.50*

## 4) Sensitivity Notes

- **Which variable drives cost most:** Output tokens — at $15/1M they account for ~79% of per-request cost. Reducing average output tokens from 1,500 to 750 (via concise system prompts) would cut costs by ~40%.
- **Worst-case high-usage scenario estimate:** Power users issuing 20 commands/session × 20 sessions/month = 400 commands/user/month. At 100K users this would be $570K/mo — mitigated by rate limiting (5 req/min/user) and tiered pricing.
- **Cost-control levers:**
  1. **Prompt caching** — Anthropic prompt caching reduces input token costs by 90% for repeated system prompts (board state context); estimated savings: 30-40% of input costs.
  2. **Model routing** — Use Claude 3.5 Haiku ($0.25/$1.25 per 1M tokens) for simple single-step commands, Sonnet for complex/template commands. Estimated 60% of commands are simple → blended cost drops ~50%.
  3. **Rate limits** — Already implemented at 5 req/min/user; prevents runaway usage.
  4. **Response trimming** — Constrain `max_tokens` to 1,000 for simple commands; current 2,000 cap is conservative.

## 5) Optimistic vs Conservative Scenarios

| Scenario | 1K Users | 10K Users | 100K Users |
|---|---|---|---|
| **Conservative** (as projected above) | $1,425 | $14,250 | $142,500 |
| **Optimistic** (Haiku routing + prompt caching) | $350 | $3,500 | $35,000 |
| **Worst-case** (power users, no optimization) | $5,700 | $57,000 | $570,000 |

## 6) Validation Checklist

1. ✅ Rates reflect Anthropic Claude Sonnet 4 pricing as of Feb 2026.
2. ✅ Assumptions explicit and consistent across scales.
3. ✅ Optimistic and conservative scenarios included.
