# AI Cost Analysis

Date: February 19, 2026
Project: CollabBoard

## 1) Development and Testing Cost (Actual)

Fill this section with actual tracked usage from development.

| Cost Category | Value |
|---|---|
| Total API calls | `TODO` |
| Input tokens | `TODO` |
| Output tokens | `TODO` |
| Model/provider(s) used | `TODO` |
| Total development AI spend (USD) | `TODO` |
| Other AI-related costs (if any) | `TODO` |

## 2) Production Cost Projection Assumptions

| Assumption | Value |
|---|---|
| Avg AI commands per active user per session | `TODO` |
| Avg sessions per user per month | `TODO` |
| Avg input tokens per command | `TODO` |
| Avg output tokens per command | `TODO` |
| Blended cost per 1M input tokens (USD) | `TODO` |
| Blended cost per 1M output tokens (USD) | `TODO` |

Formula reference:

- Commands/month = users * commands/session * sessions/month
- Input tokens/month = commands/month * avg input tokens/command
- Output tokens/month = commands/month * avg output tokens/command
- Monthly cost = (input_tokens/1,000,000 * input_rate) + (output_tokens/1,000,000 * output_rate)

## 3) Monthly Projection Table

| User Scale | Estimated Monthly Cost (USD) |
|---|---|
| 100 users | `TODO` |
| 1,000 users | `TODO` |
| 10,000 users | `TODO` |
| 100,000 users | `TODO` |

## 4) Sensitivity Notes

- Which variable drives cost most: `TODO`
- Worst-case high-usage scenario estimate: `TODO`
- Cost-control levers (prompt trimming, caching, rate limits): `TODO`

## 5) Validation Checklist

1. Ensure rates reflect actual model pricing at time of submission.
2. Keep assumptions explicit and consistent across scales.
3. Add one optimistic and one conservative scenario if requested.
