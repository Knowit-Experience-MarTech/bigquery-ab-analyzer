create or replace function `your_project.bigquery_ab_analyzer.udf_ab_count_welch`(
	n_a int64,
	mean_a float64,
	var_a float64,
	n_b int64,
	mean_b float64,
  var_b float64,
  confidence_level float64,
  hypothesis string) 
  returns struct<metric_a float64, metric_b float64, stat float64, df float64, p_value float64, significance string, details string> as (
    (
      with inps as (
        select
          cast(greatest(n_a, 1) as float64) as n1,
          cast(greatest(n_b, 1) as float64) as n2,
          mean_a as m1,
          mean_b as m2,
          greatest(var_a, 0.0) as v1,
          greatest(var_b, 0.0) as v2,
          -- normalize confidence to (0,1)
          case
            when confidence_level is null then 0.95
            when confidence_level > 1 then least(confidence_level / 100.0, 0.999999999)
            else least(greatest(confidence_level, 1e-9), 0.999999999)
          end as cl,
          case
            when lower(trim(hypothesis)) in ('two-sided','two sided','two_sided') then 'two-sided'
            else 'one-sided'
          end as H
      ),
      core as (
        select
          n1,
          n2,
          m1,
          m2,
          v1,
          v2,
          cl,
          H,
          (v1/n1) + (v2/n2) as se2_raw,
          safe_divide(power((v1/n1)+(v2/n2), 2),
            nullif(
              safe_divide(power(v1/n1, 2), nullif(n1-1,0)) +
              safe_divide(power(v2/n2, 2), nullif(n2-1,0))
            ,0)
          ) as df
        from inps
      ),
      tcalc as (
        select
          n1,
          n2,
          m1,
          m2,
          v1,
          v2,
          cl,
          H,
          df,
          greatest(se2_raw, 0.0) as se2,
          case
            when se2_raw <= 0 then null
            else (m2 - m1) / SAFE.SQRT(greatest(se2_raw, 0.0))  -- <== was (m1 - m2)
          end as t
        from core
      ),
      -- Normal CDF approximation (Abramowitz–Stegun 26.2.17)
      norm as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          abs(t) as az,
          1.0 - cl as alpha
        from tcalc
      ),
      poly as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          alpha,
          1.0 / (1.0 + 0.2316419 * abs(t)) as tt,
          0.3989422804014327 * exp(-0.5 * abs(t) * abs(t)) as phi_abs
        from norm
      ),
      cdf as (
        select
          n1,
          n2,
          m1,
          m2,
          cl,
          H,
          df,
          t,
          alpha,
          -- tail(|t|) ≈ φ(|t|) * P(tt)
          (phi_abs * (((((1.330274429 * tt - 1.821255978) * tt + 1.781477937) * tt - 0.356563782) * tt + 0.319381530) * tt)) as tail_abs,
          phi_abs
        from poly
      ),
      pvals as (
        select
          m1,
          m2,
          df,
          t,
          alpha,
          H,
          -- Φ(|t|) = 1 - tail(|t|)
          1.0 - tail_abs as Phi_abs,
          case
            when t is null then null
            when H = 'one-sided' then 1.0 - (case when t >= 0 then (1.0 - tail_abs) else tail_abs end)  -- 1 - Φ(t), alt.: B>A
            else 2.0 * (1.0 - (1.0 - tail_abs))  -- two-sided: 2*(1-Φ(|t|)) = 2*tail(|t|)
          end as p
        from cdf
      )
      select as struct
        m1 as metric_a,
        m2 as metric_b,
        t as stat,
        df as df,
        case when p is null then null else p end as p_value,
        case
          when t is null then 'NOT_EVALUATED'
          when p < alpha then 'SIGNIFICANT'
          else 'NOT_SIGNIFICANT'
        end as significance,
        case
          when t is null then 'Insufficient information.'
          when p < alpha then
            case
              when m2 > m1 then concat('Variant B is ',
                cast(round(safe_divide(m2 - m1, nullif(m1,0)) * 100, 1) as string),
                '% better than Variant A.')
              when m1 > m2 then concat('Variant A is ',
                cast(round(safe_divide(m1 - m2, nullif(m2,0)) * 100, 1) as string),
                '% better than Variant B.')
              else 'No difference.'
            end
          else 'No significant difference.'
        end as details
      from pvals
    )
);