/**
 * Copyright 2026 Knowit AI & Analytics
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
 ----------------------------------------------------------------------------
 -- Replace "your_project" with your project.
 -- The GA4 source table (project, data set, table) and the BigQuery region
 -- come from the sheet settings.
----------------------------------------------------------------------------

begin

  ----------------------------------------------------------------------------
  -- (0) Declare top-level variables
  ----------------------------------------------------------------------------
  declare bq_region                string default 'region-eu';

  declare user_count               int64   default 0;
  declare conversion_count         int64   default 0;
  declare total_conversion_value   float64 default 0.0;
  declare total_conversion_sq_value float64 default 0.0;
  declare converter_count          int64   default 0;   -- participants with at least one conversion
  declare total_conversion_count_sq float64 default 0.0; -- sum over participants of (conversion events)^2
  -- Sum of squared deviations among converting participants (value and event count). Used for
  -- numerically stable variances instead of sum(x^2) - sum(x)^2 / n.
  declare conversion_value_m2      float64 default 0.0;
  declare conversion_count_m2      float64 default 0.0;
  -- Value test unit. TRUE: value per participant (non-converters count as 0), recommended primary metric.
  -- FALSE: value per converting participant (closer to average order value).
  declare value_per_participant    bool    default true;
  -- Sample Ratio Mismatch: expected share of participants in variant B (0.5 = 50/50 split).
  declare srm_expected_share_b     float64 default 0.5;
  -- Sequential monitoring. TRUE: significance uses an O'Brien-Fleming type boundary based on how much
  -- of the target sample (ai_total_target_sample, A + B) has been collected, so results stay valid
  -- when the report is checked every day and the test is stopped as soon as it is SIGNIFICANT.
  -- FALSE: classic fixed-horizon test (only valid if you look once, at the target sample).
  declare sequential_monitoring    bool    default true;
  -- Target sample used when an experiment has none (same default as the AI summary).
  declare default_target_sample    int64   default 2000;
  declare dyn_sql                  string  default "";
  declare exp_filter               string  default "";
  declare conv_filter              string  default "";
  declare id_expr                  string  default 'user_pseudo_id';
  declare id_predicate             string  default 'user_pseudo_id IS NOT NULL';
  declare id_filter                string  default '';
  declare conv_side_sql            string;
  declare value_expr               string  default 'null';
  -- Item filters on the conversion event, used inside item-level value metrics (items.*)
  declare item_value_filter        string  default '';
  declare item_field               string  default '';

  -- Funnel Add-on Variables
  declare funnel_json_str string default null;
  declare funnel_cte_sql string;
  declare funnel_select_sql string;
  declare funnel_steps_json json;
  declare num_steps int64;
  declare current_event string;
  declare current_param_key string;
  declare current_param_val string;
  declare param_filter string;
  declare union_string string;
  declare i int64;
  declare explicit_step int64;
  declare has_funnel_params bool;
  declare param_col_sql string;
  declare funnel_grouping string;
  declare current_step_label string;
  declare has_funnel_items bool default false;
  declare is_item_scope bool default false;
  declare clean_param_field string default '';
  declare j int64;
  declare num_sub_filters int64;
  declare current_filters_json json;
  declare sub_filter_key string;
  declare sub_filter_val string;
  declare is_sub_item bool;
  declare clean_sub_field string;

  declare sql_header               string;
  declare sql_logic                string;
  declare sql_footer               string;

  declare query_info_logging       bool default false;
  declare query_price_per_tib      float64;
  
  declare ai_summary_activated     bool default false; 
  declare ai_prompt                string default '';

  -- Firebase-aware logic
  declare exposure_guard           string  default '';
  declare variant_key              string  default '';
  declare test_variants_regex      string  default '';

  -- Validates if GA4 data exists
  declare is_ga4 bool default (
    select exists(
      select 1 
      from `your_project.bigquery_ab_analyzer.experiments` 
      where analyze_test = true
        and analytics_tool = 'GOOGLE ANALYTICS'
    )
  );

  if is_ga4 then -- It's a GA4 query, run the query.

    set (
      query_info_logging,
      query_price_per_tib, 
      ai_summary_activated, 
      ai_prompt,
      bq_region
    ) = (
      select as struct 
        query_information_logging,
        query_price_per_tib,
        ai_summary_activated,
        trim(ai_prompt),
        case 
          when starts_with(lower(trim(region)), 'region-') then lower(trim(region))
          -- 'regionnorm' was written by an earlier version of the sheet script; treat it as unset.
          when region is null or trim(region) = '' or lower(trim(region)) = 'regionnorm' then 'region-eu'
          else concat('region-', lower(trim(region)))
        end
      from `your_project.bigquery_ab_analyzer.settings`
      limit 1
    );
  
    if ai_prompt is null or ai_prompt = '' then
      set ai_prompt = concat(
        'You are a senior CRO and data analytics consultant summarizing A/B test results for an executive dashboard.\n',
        'Write exactly two concise, highly structured paragraphs of professional prose separated by a single blank line. Do not use rule titles, bullet points, hyphens, or markdown headings.\n',
        '\n',
        'Paragraph 1 - Executive Decision & Statistical Summary:\n',
        '1. Lead immediately with a clear verdict: Declare the winning variant (or "Inconclusive/No Winner"), state whether it achieved the Required Confidence Level, and quote the exact conversion lift from "Conversion Details" together with the "Conversion Lift Confidence Interval" as its likely range.\n',
        '2. Synthesize business impact: "Value Metric" describes what the value measures; describe the value exactly that way and do not assume it is revenue, items or anything else. "Value per Participant" includes participants who did not convert and is the main business metric. Use "Value per Conversion" to explain whether a value lift comes from more conversions, bigger conversions, or both. Treat values as unitless (do not add currency symbols). Reference Conversion P-Value or Value P-Value explicitly without scientific notation.\n',
        '3. Decision & Horizon Check: If "Significance Method" is sequential monitoring, a SIGNIFICANT result is valid to act on even before {{TARGET_SAMPLE}} is reached, and the test can be closed. If a result is NOT_SIGNIFICANT and traffic is below target, recommend letting the test run for the "Estimated Days Remaining". If the target is reached and the result is still NOT_SIGNIFICANT, recommend closing the test as inconclusive. If "Significance Method" is fixed horizon and traffic is below target, warn of false-positive (peeking) risk instead. If underpowered (<1000 sample target), note the detection limitation.\n',
        '4. Caveats: If "Method Warnings" lists anything, state it plainly. If the Sample Ratio Mismatch Check is SRM_DETECTED, state that the results cannot be trusted until the traffic split is fixed, regardless of significance.\n',
        '\n',
        'Paragraph 2 - Funnel & User Behavior Dynamics:\n',
        'If funnel journey data is provided:\n',
        '1. Journey Bottlenecks: Identify the step with the highest drop-off and explain specifically where and how the winning variant outperforms the control (e.g., superior top-of-funnel engagement vs. checkout completion).\n',
        '2. Behavioral Latency: Compare median vs. average step duration. If average time is substantially higher than median time, explicitly explain that a subset of users is delaying action (long-tail delay / return visits).\n',
        'If no funnel data is present, omit this second paragraph entirely.'
      );
    end if;

    ----------------------------------------------------------------------------
    -- (2) Create TEMP tables for final results
    ----------------------------------------------------------------------------

    if query_info_logging then
      create or replace temp table bigquery_ab_analyzer_query_information_buffer (
        id string,
        job_id string,
        bytes_billed int64
      );
    end if;

    create temp table results (
      id                     string,
      variant                string,
      variant_name           string,
      conversion_event       string,
      scope                  string,
      user_overlap           string,
      date_start             date,
      date_end               date,
      user_count             int64,
      conversion_count       int64,
      total_conversion_value float64,
      total_conversion_sq_value float64,
      converter_count        int64,
      total_conversion_count_sq float64,
      conversion_value_m2    float64,
      conversion_count_m2    float64
    );

    ----------------------------------------------------------------------------
    -- (3) Loop over each experiment–variant row from the experiments table
    ----------------------------------------------------------------------------
    for rec in (
      select
        id,
        variant,
        variant_name,
        date_start,
        date_end,
        experiment_event_name,
        experiment_variant_parameter,
        exp_variant_string,
        conversion_event,
        scope,
        identity_source,
        user_overlap,
        experiment_event_value_parameter,
        conversion_count_all,
        analyze_funnel,
        funnel_steps,
        -- Pull dynamic source coordinates from experiments table
        source_project_id,
        source_dataset_id,
        source_table_id
      from `your_project.bigquery_ab_analyzer.experiments`
      where analyze_test = true
        and analytics_tool = 'GOOGLE ANALYTICS'
    ) do

      -- Stop with a clear message if the sheet has not sent the source table for this experiment.
      if coalesce(trim(rec.source_project_id), '') = ''
        or coalesce(trim(rec.source_dataset_id), '') = ''
        or coalesce(trim(rec.source_table_id), '') = '' then
        raise using message = concat(
          'Experiment ', rec.id, ' (variant ', rec.variant, ') has no source table. ',
          'Check the BigQuery project, dataset and table in the sheet settings, then export the experiments to BigQuery again.'
        );
      end if;

      ----------------------------------------------------------------------------
      -- (4) Build conditions that do not depend on the filters table
      ----------------------------------------------------------------------------
      if rec.scope = "User" then
        if rec.identity_source = "USER_ID_ONLY" then
          set id_expr = "user_id";
          set id_predicate = "user_id is not null and user_id != ''";
          set id_filter = " and user_id is not null and user_id != ''";
        elseif rec.identity_source = "USER_ID_OR_DEVICE_ID" then
          set id_expr = "coalesce(nullif(user_id, ''), user_pseudo_id)";
          set id_predicate = "(user_id is not null and user_id != '' OR user_pseudo_id is not null)";
          set id_filter = "";
        elseif rec.identity_source = "EXP_DEVICE_ID" then
          set id_expr = "(select coalesce(value.string_value, cast(value.int_value as string), cast(value.float_value as string), cast(value.double_value as string)) from unnest(event_params) where key = 'exp_device_id')";
          set id_predicate = "(select coalesce(value.string_value, cast(value.int_value as string), cast(value.float_value as string), cast(value.double_value as string)) from unnest(event_params) where key = 'exp_device_id') is not null";
          set id_filter = "";
        else  -- DEVICE_ID
          set id_expr = "user_pseudo_id";
          set id_predicate = "user_pseudo_id is not null";
          set id_filter = "";
        end if;
      else
        set id_expr = "user_pseudo_id";
        set id_predicate = "user_pseudo_id is not null";
        set id_filter = "";
      end if;

      set exp_filter = "";
      set conv_filter = "";
      set item_value_filter = "";

      set test_variants_regex = coalesce((
        select string_agg(concat('(', coalesce(exp_variant_string, ''), ')'), '|')
        from `your_project.bigquery_ab_analyzer.experiments` 
        where id = rec.id and analyze_test = true
      ), '.*');

      if regexp_contains(rec.experiment_event_name, r'^firebase_exp_\d+$') then
        set variant_key = rec.experiment_event_name;
        set exposure_guard = concat(
          " and exists (select 1 from unnest(user_properties) up ",
          "where up.key = '", replace(variant_key, "'", "\\'"), "')"
        );
      else
        set variant_key = rec.experiment_variant_parameter;
        set exposure_guard = concat(
          " and event_name = '", replace(rec.experiment_event_name, "'", "\\'"), "'"
        );
      end if;

      ----------------------------------------------------------------------------
      -- (3b) Gather filters for this (id, variant)
      ----------------------------------------------------------------------------
      for f in (
        select
          filter_type,
          filter_on_value,
          filter_field,
          filter_value,
          filter_scope
        from `your_project.bigquery_ab_analyzer.experiments_filters`
        where id = rec.id
          and variant = rec.variant
      ) do
        begin
          declare is_exclude bool default upper(f.filter_type) = 'EXCLUDE';
          declare safe_filter_val string default replace(replace(f.filter_value, r'\\', r'\\\\'), r"'", r"\'");
          declare norm_path string default regexp_replace(
            regexp_replace(trim(f.filter_field), r'\s*\.\s*', '.'),
            r'\s+', '.'
          );

          if f.filter_scope = "Event" then
            if f.filter_on_value in ("Experiment Event", "Both") then
              set exp_filter = exp_filter || concat(
                " and ",
                case when is_exclude then "not " else "" end,
                "regexp_contains((",
                  "select coalesce(p.value.string_value, cast(p.value.int_value as string), ",
                      "cast(p.value.float_value as string), cast(p.value.double_value as string)) ",
                  "from unnest(event_params) p where p.key = '", replace(f.filter_field, "'", "\\'"), "' limit 1), ",
                  "r'''", safe_filter_val, "''')"
              );
            end if;

            if f.filter_on_value in ("Conversion Event", "Both") then
              set conv_filter = conv_filter || concat(
                " and ",
                case when is_exclude then "not " else "" end,
                "regexp_contains((",
                  "select coalesce(x.value.string_value, cast(x.value.int_value as string), ",
                      "cast(x.value.float_value as string), cast(x.value.double_value as string)) ",
                  "from unnest(event_params) x where x.key = '", replace(f.filter_field, "'", "\\'"), "' limit 1), ",
                  "r'''", safe_filter_val, "''')"
              );
            end if;

          elseif f.filter_scope = "User" then
            if f.filter_on_value in ("Experiment Event", "Both") then
              set exp_filter = exp_filter || concat(
                " and ",
                case when is_exclude then "not " else "" end,
                "regexp_contains((",
                  "select coalesce(up.value.string_value, cast(up.value.int_value as string), ",
                      "cast(up.value.float_value as string), cast(up.value.double_value as string)) ",
                  "from unnest(user_properties) up where up.key = '", replace(f.filter_field, "'", "\\'"), "' limit 1), ",
                  "r'''", safe_filter_val, "''')"
              );
            end if;

            if f.filter_on_value in ("Conversion Event", "Both") then
              set conv_filter = conv_filter || concat(
                " and ",
                case when is_exclude then "not " else "" end,
                "regexp_contains((",
                  "select coalesce(up.value.string_value, cast(up.value.int_value as string), ",
                      "cast(up.value.float_value as string), cast(up.value.double_value as string)) ",
                  "from unnest(user_properties) up where up.key = '", replace(f.filter_field, "'", "\\'"), "' limit 1), ",
                  "r'''", safe_filter_val, "''')"
              );
            end if;

          elseif upper(f.filter_scope) = 'COLUMN' then
            if regexp_contains(norm_path, r'^items[.]') then
              if f.filter_on_value in ("Experiment Event", "Both") then
                set exp_filter = exp_filter || concat(
                  " and ",
                  case when is_exclude then "not " else "" end,
                  "exists (select 1 from unnest(items) it where ",
                    "regexp_contains(coalesce(cast(",
                    regexp_replace(norm_path, r'^items[.]', 'it.'), " as string), ''), ",
                    "r'''", safe_filter_val, "'''))"
                );
              end if;

              if f.filter_on_value in ("Conversion Event", "Both") then
                set conv_filter = conv_filter || concat(
                  " and ",
                  case when is_exclude then "not " else "" end,
                  "exists (select 1 from unnest(items) it where ",
                    "regexp_contains(coalesce(cast(",
                    regexp_replace(norm_path, r'^items[.]', 'it.'), " as string), ''), ",
                    "r'''", safe_filter_val, "'''))"
                );
                -- The same filter per item, so item-level value metrics only count matching items.
                set item_value_filter = item_value_filter || concat(
                  " and ",
                  case when is_exclude then "not " else "" end,
                  "regexp_contains(coalesce(cast(",
                    regexp_replace(norm_path, r'^items[.]', 'it.'), " as string), ''), ",
                    "r'''", safe_filter_val, "''')"
                );
              end if;

            else
              if f.filter_on_value in ("Experiment Event", "Both") then
                set exp_filter = exp_filter || concat(
                  " and ",
                  case when is_exclude then "not " else "" end,
                  "regexp_contains(coalesce(cast(", norm_path, " as string), ''), ",
                  "r'''", safe_filter_val, "''')"
                );
              end if;

              if f.filter_on_value in ("Conversion Event", "Both") then
                set conv_filter = conv_filter || concat(
                  " and ",
                  case when is_exclude then "not " else "" end,
                  "regexp_contains(coalesce(cast(", norm_path, " as string), ''), ",
                  "r'''", safe_filter_val, "''')"
                );
              end if;
            end if;
          end if;
        end;
      end for;

      set exp_filter = exp_filter || id_filter;
      set conv_filter = conv_filter || id_filter;

      if rec.experiment_event_value_parameter is null
        or trim(rec.experiment_event_value_parameter) = '' then
        set value_expr = 'null';

      elseif starts_with(lower(trim(rec.experiment_event_value_parameter)), 'items.') then
        -- Item-level value: sum the field over the items in the event that match the item filters
        -- on the conversion event, e.g. items.quantity or items.item_revenue for one item category.
        set item_field = regexp_replace(lower(trim(rec.experiment_event_value_parameter)), r'^items[.]', '');
        if not regexp_contains(item_field, r'^[a-z_][a-z0-9_]*$') then
          set value_expr = 'null';
        else
          set value_expr = concat(
            '(select sum(safe_cast(',
            case item_field
              -- GA4 fills item_revenue on purchase only; use price x quantity on other events.
              when 'item_revenue' then 'coalesce(it.item_revenue, it.price * it.quantity)'
              when 'item_revenue_in_usd' then 'coalesce(it.item_revenue_in_usd, it.price_in_usd * it.quantity)'
              else concat('it.', item_field)
            end,
            ' as float64)) from unnest(items) it where true', item_value_filter, ')'
          );
        end if;

      elseif starts_with(lower(rec.experiment_event_value_parameter), 'ecommerce.') then
        set value_expr = concat('safe_cast(', rec.experiment_event_value_parameter, ' as float64)');

      else
        set value_expr = concat(
          '(select coalesce(',
          'safe_cast(x.value.int_value as float64), ',
          'safe_cast(x.value.float_value as float64), ',
          'safe_cast(x.value.double_value as float64)',
          ') ',
          'from UNNEST(event_params) x ',
          "where x.key = '", replace(rec.experiment_event_value_parameter, "'", "\\'"), "' ",
          'limit 1)'
        );
      end if;

      ----------------------------------------------------------------------------
      -- (4e) Build the conversion-side CTE
      ----------------------------------------------------------------------------
      set conv_side_sql = format("""
        , conv_side as (
          select
            case when upper(trim('%s')) = 'USER' then %s
              else concat(user_pseudo_id, cast((select s.value.int_value from unnest(event_params) s where s.key = 'ga_session_id' limit 1) as string))
            end as grouping_key,
            timestamp_micros(event_timestamp) as conv_time,
            %s as conv_value
          from all_events
          where table_suffix between '%s' and '%s'
            and event_name = '%s'
            %s
        )
      """, 
        coalesce(rec.scope, 'User'), 
        id_expr, 
        value_expr, 
        format_date('%Y%m%d', rec.date_start), 
        format_date('%Y%m%d', rec.date_end), 
        replace(coalesce(rec.conversion_event, ''), "'", "\\'"), 
        conv_filter
      );

      ----------------------------------------------------------------------------
      -- Dynamic Funnel CTEs
      ----------------------------------------------------------------------------
      set funnel_cte_sql = '';
      set funnel_select_sql = 'cast(null as string)';
      
      if coalesce(rec.analyze_funnel, false) = true and coalesce(rec.funnel_steps, '') != '' then
        
        set funnel_steps_json = parse_json(rec.funnel_steps);
        set num_steps = array_length(json_extract_array(rec.funnel_steps));
        set union_string = '';
        set i = 1;
        
        -- Carry event_params, items, or both only when needed
        set has_funnel_params = (
          select count(1) > 0 
          from unnest(json_extract_array(rec.funnel_steps)) as step,
            unnest(coalesce(json_extract_array(step, '$.filters'), [step])) as f
          where json_value(f, '$.param_key') is not null 
            and trim(json_value(f, '$.param_key')) != ''
            and not regexp_contains(lower(trim(json_value(f, '$.param_key'))), r'^(items\.|item_id$|item_name$|item_brand$|item_category[2-5]?$|item_variant$|affiliation$|coupon$|discount$|price$|quantity$)')
        );

        set has_funnel_items = (
          select count(1) > 0 
          from unnest(json_extract_array(rec.funnel_steps)) as step,
            unnest(coalesce(json_extract_array(step, '$.filters'), [step])) as f
          where json_value(f, '$.param_key') is not null 
            and trim(json_value(f, '$.param_key')) != ''
            and regexp_contains(lower(trim(json_value(f, '$.param_key'))), r'^(items\.|item_id$|item_name$|item_brand$|item_category[2-5]?$|item_variant$|affiliation$|coupon$|discount$|price$|quantity$)')
        );

        set param_col_sql = concat(
          case when has_funnel_params then ', event_params' else '' end,
          case when has_funnel_items then ', items' else '' end
        );

        if upper(trim(coalesce(rec.scope, 'User'))) = 'SESSION' then
          set funnel_grouping = "concat(user_pseudo_id, cast((select s.value.int_value from unnest(event_params) s where s.key = 'ga_session_id' limit 1) as string))";
        else
          set funnel_grouping = id_expr;
        end if;
          
        -- 1. Base Funnel CTE
        set funnel_cte_sql = format("""
          , funnel_base as (
            select
              %s as grouping_key,
              event_name,
              timestamp_micros(event_timestamp) as event_time
              %s
            from all_events
            where table_suffix between '%s' and '%s'
              and event_name in (%s)
          )
          , step_0 as (
            select grouping_key, exposure_time as t_0
            from exposures_filtered
          )
        """, 
        funnel_grouping, 
        param_col_sql, 
        format_date('%Y%m%d', rec.date_start), 
        format_date('%Y%m%d', rec.date_end), 
        (
          select string_agg(distinct concat("'", replace(json_value(step, '$.event'), "'", "\\'"), "'"), ', ')
          from unnest(json_extract_array(rec.funnel_steps)) as step
        ));
        
        -- 2. Dynamically Generate the Cascaded Steps
        while i <= num_steps do
          set current_event = json_value(funnel_steps_json[i-1], '$.event');
          set explicit_step = coalesce(cast(json_value(funnel_steps_json[i-1], '$.step_number') as int64), i);

          -- Extract the sub-filters array, or fall back to legacy single-filter object if present
          set current_filters_json = coalesce(
            funnel_steps_json[i-1].filters,
            case 
              when json_value(funnel_steps_json[i-1], '$.param_key') is not null then
                parse_json(concat(
                  '[{"param_key":', to_json_string(json_value(funnel_steps_json[i-1], '$.param_key')), 
                  ',"param_val":', to_json_string(json_value(funnel_steps_json[i-1], '$.param_val')), '}]'
                ))
              else parse_json('[]')
            end
          );
          set num_sub_filters = coalesce(array_length(json_extract_array(current_filters_json)), 0);

          -- Reset filter string and label for this step
          set param_filter = '';
          set current_step_label = current_event;
          set j = 1;

          -- NESTED LOOP: Iterate over all filters assigned to this step
          while j <= num_sub_filters do
            set sub_filter_key = json_value(current_filters_json[j-1], '$.param_key');
            set sub_filter_val = json_value(current_filters_json[j-1], '$.param_val');

            if sub_filter_key is not null and sub_filter_val is not null and trim(sub_filter_key) != '' then
              set current_step_label = concat(current_step_label, if(j = 1, ' (', ', '), sub_filter_key, ' = ', sub_filter_val);

              set clean_sub_field = trim(sub_filter_key);
              set is_sub_item = regexp_contains(
                lower(clean_sub_field), 
                r'^(items\.|item_id$|item_name$|item_brand$|item_category[2-5]?$|item_variant$|affiliation$|coupon$|discount$|price$|quantity$)'
              );

              if is_sub_item then
                set clean_sub_field = regexp_replace(clean_sub_field, r'^items?\.', '');
                set param_filter = param_filter || format("""
                  and coalesce((
                    select logical_or(regexp_contains(coalesce(cast(it.%s as string), ''), r'''%s'''))
                    from unnest(f.items) it
                  ), false)
                """, 
                  replace(clean_sub_field, "'", "\\'"), 
                  replace(replace(sub_filter_val, '%', '%%'), "'''", "\\'\\'\\'")
                );
              else
                set param_filter = param_filter || format("""
                  and regexp_contains((
                    select coalesce(p.value.string_value, cast(p.value.int_value as string), cast(p.value.float_value as string), cast(p.value.double_value as string)) 
                    from unnest(f.event_params) p where p.key = '%s' limit 1
                  ), r'''%s''')
                """, 
                  replace(clean_sub_field, "'", "\\'"), 
                  replace(replace(sub_filter_val, '%', '%%'), "'''", "\\'\\'\\'")
                );
              end if;
            end if;

            set j = j + 1;
          end while;

          -- Close parenthesis on label if filters were added
          if num_sub_filters > 0 and current_step_label != current_event then
            set current_step_label = concat(current_step_label, ')');
          end if;

          -- Build Step CTEs
          if i = 1 then
            set funnel_cte_sql = funnel_cte_sql || format("""
              , step_%d as (
                select s.grouping_key, s.t_0, min(f.event_time) as t_%d
                from step_%d s
                left join funnel_base f on s.grouping_key = f.grouping_key 
                  and f.event_name = '%s' 
                  and f.event_time >= s.t_%d
                  %s
                group by 1, 2
              )
            """, i, i, i-1, replace(current_event, "'", "\\'"), i-1, param_filter);
                
            set union_string = union_string || format("SELECT %d as step_number, r'''%s''' as step_name, count(t_%d) as participants, 0.0 as avg_time, 0.0 as median_time FROM step_%d\n", 
              explicit_step, 
              replace(replace(current_step_label, '%', '%%'), "'''", "\\'\\'\\'"), 
              i, i);
          else
            set funnel_cte_sql = funnel_cte_sql || format("""
              , step_%d as (
                select s.*, min(f.event_time) as t_%d
                from step_%d s
                left join funnel_base f on s.grouping_key = f.grouping_key 
                  and f.event_name = '%s' 
                  and f.event_time > s.t_%d
                  %s
                group by %s
              )
            """, i, i, i-1, replace(current_event, "'", "\\'"), i-1, param_filter, (select string_agg(cast(x as string), ', ') from unnest(generate_array(1, i+1)) as x));
                
            set union_string = union_string || format("UNION ALL\nSELECT %d as step_number, r'''%s''' as step_name, count(t_%d) as participants, coalesce(avg(timestamp_diff(t_%d, t_%d, second)), 0.0) as avg_time, coalesce(approx_quantiles(timestamp_diff(t_%d, t_%d, second), 100)[offset(50)], 0.0) as median_time FROM step_%d\n", 
              explicit_step, 
              replace(replace(current_step_label, '%', '%%'), "'''", "\\'\\'\\'"), 
              i, i, i-1, i, i-1, i);
          end if;
              
          set i = i + 1;
        end while;

        -- 3. Wrap in Window Functions and convert to JSON array
        set funnel_cte_sql = funnel_cte_sql || format("""
          , funnel_union as ( %s )
          , funnel_math as (
          select 
            step_number, step_name, participants, 
            avg_time as avg_time_from_previous_sec,
            median_time as median_time_from_previous_sec,
            1.0 - safe_divide(participants, lag(participants) over(order by step_number)) as drop_off_rate_from_previous,
            safe_divide(participants, first_value(participants) over(order by step_number)) as total_conversion_rate
          from funnel_union
        )
      """, union_string);
          
        set funnel_select_sql = "(select to_json_string(array(select as struct * from funnel_math)))";
        
      end if;

      ----------------------------------------------------------------------------
      -- (4f) Build the Universal Footer based on counting mode
      ----------------------------------------------------------------------------
      -- Every statistic is built from one row per participant (grouping_key), so the
      -- tests use participants as the unit of analysis, also in "Once per Event" mode.
      -- conversion_count keeps its old meaning: events in "Once per Event" mode,
      -- converting participants otherwise.
      set sql_footer = format("""
          %s
          %s
          , joined_raw as (
            select e.grouping_key, coalesce(c.conv_value, 0) as conv_value
            from exposures_filtered e
            join conv_side c using (grouping_key)
            where c.conv_time >= e.exposure_time
          )
          , per_participant as (
            select
              grouping_key,
              count(*) as conv_events,
              sum(conv_value) as conv_value
            from joined_raw
            group by grouping_key
          )
          select
            (select count(distinct grouping_key) from exposures_filtered) as user_count,
            coalesce((select %s from per_participant), 0) as conversion_count,
            coalesce((select count(*) from per_participant), 0) as converter_count,
            coalesce((select sum(conv_value) from per_participant), 0.0) as total_conversion_value,
            coalesce((select sum(pow(conv_value, 2)) from per_participant), 0.0) as total_conversion_sq_value,
            coalesce((select sum(pow(conv_events, 2)) from per_participant), 0.0) as total_conversion_count_sq,
            coalesce((select var_samp(conv_value) * (count(*) - 1) from per_participant), 0.0) as conversion_value_m2,
            coalesce((select var_samp(conv_events) * (count(*) - 1) from per_participant), 0.0) as conversion_count_m2,
            %s as funnel_json_str
      """,
        conv_side_sql,
        funnel_cte_sql,
        if(rec.conversion_count_all, 'sum(conv_events)', 'count(*)'),
        funnel_select_sql
      );

      ----------------------------------------------------------------------------
      -- (4g) Build the Header (DYNAMIC TABLE IDENTIFIER)
      ----------------------------------------------------------------------------
      set sql_header = format("""
        with all_events as (
          select *, _TABLE_SUFFIX as table_suffix
          from `%s.%s.%s`
          where %s
        ),
        extracted as (
          select a.*,
            (select p.value.string_value from unnest(a.event_params) p where p.key = '%s' limit 1) as variant_value
          from all_events a
        ),
        exposures_all as (
          select
            case when upper(trim('%s')) = 'USER' then %s
              else concat(user_pseudo_id, cast((select s.value.int_value from unnest(event_params) s where s.key = 'ga_session_id' limit 1) as string))
            end as grouping_key,
            timestamp_micros(event_timestamp) as exposure_time,
            trim(coalesce(variant_value,'')) as variant
          from extracted
          where table_suffix between '%s' and '%s'
            %s  -- exposure_guard
            %s  -- exp_filter
        ),
        exposures_labeled as (
          select grouping_key, exposure_time, variant
          from exposures_all
          where variant is not null and variant != ''
        )
      """, 
        rec.source_project_id,
        rec.source_dataset_id,
        concat(rtrim(trim(rec.source_table_id), '*'), '*'),
        id_predicate,                                                                                
        replace(coalesce(variant_key, ''), "'", "\\'"),                                                                                                                                
        coalesce(rec.scope, 'User'), id_expr,                                                        
        format_date('%Y%m%d', rec.date_start), format_date('%Y%m%d', rec.date_end),
        exposure_guard, exp_filter
      );

      ----------------------------------------------------------------------------
      -- (5) User Overlap Logic with Raw String Triple Quotes (r'''...''')
      ----------------------------------------------------------------------------
      if upper(trim(coalesce(rec.user_overlap, ''))) = 'FIRST EXPOSURE' then
        set sql_logic = format("""
          , exposures_first as (
            select grouping_key, exposure_time, variant as variant_label
            from (
              select *, row_number() over (partition by grouping_key ORDER by exposure_time ASC) rn
              from exposures_labeled
              where regexp_contains(variant, r'''%s''')
            ) where rn = 1
          ),
          exposures_filtered as (
            select grouping_key, exposure_time
            from exposures_first
            where regexp_contains(trim(variant_label), r'''%s''')
          )
        """, 
          replace(replace(test_variants_regex, '%', '%%'), "'''", "\\'\\'\\'"), 
          replace(replace(coalesce(rec.exp_variant_string, ''), '%', '%%'), "'''", "\\'\\'\\'")
        );
        set dyn_sql = sql_header || sql_logic || sql_footer;

      elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'LAST EXPOSURE' then
        set sql_logic = format("""
          , exposures_last_ranked as (
             select 
               grouping_key, 
               variant, 
               row_number() over (partition by grouping_key order by exposure_time desc) as rn
             from exposures_labeled
             where regexp_contains(variant, r'''%s''')
          ),
          final_user_variant as (
             select grouping_key, variant
             from exposures_last_ranked
             where rn = 1 and regexp_contains(trim(variant), r'''%s''')
          ),
          exposures_filtered as (
             select e.grouping_key, min(e.exposure_time) as exposure_time
             from exposures_labeled e
             join final_user_variant f on e.grouping_key = f.grouping_key and e.variant = f.variant
             group by e.grouping_key
          )
        """, 
          replace(replace(test_variants_regex, '%', '%%'), "'''", "\\'\\'\\'"), 
          replace(replace(coalesce(rec.exp_variant_string, ''), '%', '%%'), "'''", "\\'\\'\\'")
        );
        set dyn_sql = sql_header || sql_logic || sql_footer;

      elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'EXCLUDE' then
        set sql_logic = format("""
          , user_variant_count as (
             select grouping_key, count(distinct variant) as variant_count
             from exposures_labeled
             where regexp_contains(variant, r'''%s''')
             group by grouping_key
          ),
          exposures_by_variant_first as (
             select grouping_key, variant, min(exposure_time) as exposure_time
             from exposures_labeled
             group by grouping_key, variant
          ),
          exposures_filtered as (
             select e.grouping_key, e.exposure_time
             from exposures_by_variant_first e
             join user_variant_count u using (grouping_key)
             where u.variant_count = 1 and regexp_contains(trim(e.variant), r'''%s''')
          )
        """, 
          replace(replace(test_variants_regex, '%', '%%'), "'''", "\\'\\'\\'"), 
          replace(replace(coalesce(rec.exp_variant_string, ''), '%', '%%'), "'''", "\\'\\'\\'")
        );
        set dyn_sql = sql_header || sql_logic || sql_footer;

      elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'CREDIT BOTH' then
        set dyn_sql = format("""
          with all_events as (
            select *, _TABLE_SUFFIX as table_suffix
            from `%s.%s.%s`
            where %s
          ),
          exposures_filtered as (
            select
              case when upper(trim('%s')) = 'USER' then %s
                else concat(user_pseudo_id, cast((select s.value.int_value from unnest(event_params) s where s.key = 'ga_session_id' limit 1) as string))
              end as grouping_key,
              min(timestamp_micros(event_timestamp)) as exposure_time
            from all_events
            where table_suffix between '%s' and '%s'
              %s
              and regexp_contains(coalesce((select p.value.string_value from unnest(event_params) p where p.key = '%s' limit 1), ''), r'''%s''')
              %s
            group by grouping_key
          )
        """, 
          rec.source_project_id,
          rec.source_dataset_id,
          concat(rtrim(trim(rec.source_table_id), '*'), '*'),
          id_predicate, 
          coalesce(rec.scope, 'User'), 
          id_expr, 
          format_date('%Y%m%d', rec.date_start), 
          format_date('%Y%m%d', rec.date_end), 
          exposure_guard, 
          replace(coalesce(variant_key, ''), "'", "\\'"), 
          replace(replace(coalesce(rec.exp_variant_string, ''), '%', '%%'), "'''", "\\'\\'\\'"), 
          exp_filter
        );
        set dyn_sql = dyn_sql || sql_footer;

      else
        set dyn_sql = null;
      end if;

      ----------------------------------------------------------------------------
      -- (6) Execute the dynamic SQL
      ----------------------------------------------------------------------------
      if dyn_sql is not null then
        execute immediate dyn_sql into user_count, conversion_count, converter_count, total_conversion_value, total_conversion_sq_value, total_conversion_count_sq, conversion_value_m2, conversion_count_m2, funnel_json_str;

        if query_info_logging then
          execute immediate format("""
            insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
            select
              '%s',
              job_id,
              total_bytes_billed
            from `%s`.INFORMATION_SCHEMA.JOBS_BY_USER
            where job_id = @@last_job_id
          """, rec.id, bq_region);
        end if;

        delete from `your_project.bigquery_ab_analyzer.experiments_funnel_report` 
        where id = rec.id and variant = rec.variant;

        if funnel_json_str is not null then
          insert into `your_project.bigquery_ab_analyzer.experiments_funnel_report` (
            id, variant, step_number, step_name, participants, 
            avg_time_from_previous_sec, median_time_from_previous_sec, drop_off_rate_from_previous, total_conversion_rate, date_last_analyzed
          )
          select 
            rec.id, 
            rec.variant, 
            cast(json_value(f, '$.step_number') as int64),
            json_value(f, '$.step_name'),
            cast(json_value(f, '$.participants') as int64),
            cast(json_value(f, '$.avg_time_from_previous_sec') as float64),
            cast(json_value(f, '$.median_time_from_previous_sec') as float64),
            cast(json_value(f, '$.drop_off_rate_from_previous') as float64),
            cast(json_value(f, '$.total_conversion_rate') as float64),
            current_date()
          from unnest(json_extract_array(funnel_json_str)) as f;
        end if;
        
        insert into results (
          id, variant, variant_name, conversion_event, scope, user_overlap,
          date_start, date_end, user_count, conversion_count, total_conversion_value, total_conversion_sq_value,
          converter_count, total_conversion_count_sq, conversion_value_m2, conversion_count_m2
        )
        values (
          rec.id, rec.variant, rec.variant_name, rec.conversion_event, rec.scope, rec.user_overlap,
          rec.date_start, rec.date_end, user_count, conversion_count, total_conversion_value, total_conversion_sq_value,
          converter_count, total_conversion_count_sq, conversion_value_m2, conversion_count_m2
        );
      end if;
    end for;

    ----------------------------------------------------------------------------
    -- (8) Final pivot + merge
    ----------------------------------------------------------------------------
    merge `your_project.bigquery_ab_analyzer.experiments_report` T
    using (
      with ab_base as (
        select
          r.id,
          e.experiment_name,
          min(r.date_start) as date_start,
          max(r.date_end) as date_end,
          r.scope,
          e.identity_source,

          sum(case when r.variant = 'A' then r.user_count else 0 end) as test_a,
          sum(case when r.variant = 'A' then r.conversion_count else 0 end) as conversion_a,
          sum(case when r.variant = 'B' then r.user_count else 0 end) as test_b,
          sum(case when r.variant = 'B' then r.conversion_count else 0 end) as conversion_b,
        
          sum(case when r.variant = 'A' then r.total_conversion_value else 0 end) as total_conversion_value_a,
          sum(case when r.variant = 'B' then r.total_conversion_value else 0 end) as total_conversion_value_b,

          sum(case when r.variant = 'A' then r.total_conversion_sq_value else 0 end) as total_conversion_sq_value_a,
          sum(case when r.variant = 'B' then r.total_conversion_sq_value else 0 end) as total_conversion_sq_value_b,

          sum(case when r.variant = 'A' then r.converter_count else 0 end) as converter_count_a,
          sum(case when r.variant = 'B' then r.converter_count else 0 end) as converter_count_b,
          sum(case when r.variant = 'A' then r.total_conversion_count_sq else 0 end) as total_conversion_count_sq_a,
          sum(case when r.variant = 'B' then r.total_conversion_count_sq else 0 end) as total_conversion_count_sq_b,
          sum(case when r.variant = 'A' then r.conversion_value_m2 else 0 end) as conversion_value_m2_a,
          sum(case when r.variant = 'B' then r.conversion_value_m2 else 0 end) as conversion_value_m2_b,
          sum(case when r.variant = 'A' then r.conversion_count_m2 else 0 end) as conversion_count_m2_a,
          sum(case when r.variant = 'B' then r.conversion_count_m2 else 0 end) as conversion_count_m2_b,

          max(if(r.variant = 'A', r.conversion_event, null)) as conv_event_a,
          max(if(r.variant = 'B', r.conversion_event, null)) as conv_event_b,

          e.confidence as confidence_level,
          max(e.ai_total_target_sample) as target_sample,
          e.hypothesis,
          e.event_value_test,
          e.analyze_test,
          e.user_overlap,
          e.date_comparison,
          e.analyze_funnel,

          case
            when e.conversion_count_all then 'Once per Event'
            when r.scope = 'User' then 'Once per User'
            else 'Once per Session'
          end as conversions_counting_mode
        from results r
        join `your_project.bigquery_ab_analyzer.experiments` e
          on r.id = e.id
        and r.variant = e.variant
        and e.analyze_test = true
        group by
          r.id, e.experiment_name, r.scope,
          e.confidence, e.hypothesis, e.event_value_test, e.analyze_test, e.user_overlap, e.date_comparison, e.identity_source, e.analyze_funnel,
          conversions_counting_mode
      ),
      ab as (
        select
          id,
          experiment_name,
          date_start,
          date_end,
          scope,
          identity_source,
          test_a,
          conversion_a,
          test_b,
          conversion_b,
          total_conversion_value_a,
          total_conversion_value_b,
          total_conversion_sq_value_a,
          total_conversion_sq_value_b,
          converter_count_a,
          converter_count_b,
          total_conversion_count_sq_a,
          total_conversion_count_sq_b,
          conversion_value_m2_a,
          conversion_value_m2_b,
          conversion_count_m2_a,
          conversion_count_m2_b,
          target_sample,

          confidence_level,
          hypothesis,
          event_value_test,
          analyze_test,
          user_overlap,
          date_comparison,
          analyze_funnel,
          case
            when conv_event_a is null then conv_event_b
            when conv_event_b is null then conv_event_a
            when conv_event_a = conv_event_b then conv_event_a
            else concat(conv_event_a, ' / ', conv_event_b)
          end as conversion_event,
          conversions_counting_mode
        from ab_base
      ),
      conv_pre as (
        with base as (
          select
            ab.*,
            ab.test_a > 0 and ab.test_b > 0
            and ab.conversion_a between 0 and ab.test_a
            and ab.conversion_b between 0 and ab.test_b as ok_prop,
            (ab.conversions_counting_mode = 'Once per Event') as is_rate_mode
          from ab
        ),
        valid_prop as (
          select *
          from base
          where not is_rate_mode and ok_prop
        ),
        stats_prop as (
          select
            b.id,
            u.rate_a, u.rate_b, u.z_val, u.p_val, u.significance, u.details
          from valid_prop b
          cross join unnest([bigquery_ab_analyzer.udf_ab_result(
            b.test_a, b.conversion_a,
            b.test_b, b.conversion_b,
            b.confidence_level, b.hypothesis
          )]) as u
        ),
        valid_rate as (
          select *
          from base
          where is_rate_mode and test_a > 0 and test_b > 0
        ),
        stats_rate as (
          -- "Once per Event": Welch test on conversion events per participant.
          -- Replaces the Poisson rate test, which assumes every event is independent and
          -- gives far too many false positives when some participants convert many times.
          select
            b.id,
            w.metric_a as rate_a,
            w.metric_b as rate_b,
            w.stat as z_val,
            w.p_value as p_val,
            w.significance,
            replace(replace(w.details, ' is ', ' has '), '% better than', '% more conversion events per participant than') as details
          from valid_rate b
          cross join unnest([bigquery_ab_analyzer.udf_ab_count_welch(
            b.test_a,
            safe_divide(b.conversion_a, b.test_a),
            bigquery_ab_analyzer.udf_zero_inflated_variance(b.test_a, b.converter_count_a, b.conversion_a, b.conversion_count_m2_a),
            b.test_b,
            safe_divide(b.conversion_b, b.test_b),
            bigquery_ab_analyzer.udf_zero_inflated_variance(b.test_b, b.converter_count_b, b.conversion_b, b.conversion_count_m2_b),
            b.confidence_level,
            b.hypothesis
          )]) as w
        )
      select
        b.id,
        b.date_start,
        b.date_end,
        b.experiment_name,
        b.conversion_event,
        b.scope,
        b.identity_source,
        b.hypothesis,
        b.confidence_level,
        b.analyze_test,
        b.user_overlap,
        b.date_comparison,
        b.analyze_funnel,
        b.test_a,
        b.conversion_a,
        b.test_b,
        b.conversion_b,
        b.target_sample,
        b.conversions_counting_mode,
        b.is_rate_mode,
        b.converter_count_a,
        b.converter_count_b,
        b.conversion_count_m2_a,
        b.conversion_count_m2_b,
        b.total_conversion_value_a,
        b.total_conversion_value_b,
        coalesce(p.rate_a, r.rate_a) as conv_rate_a,
        coalesce(p.rate_b, r.rate_b) as conv_rate_b,
        coalesce(p.z_val, r.z_val) as conv_z_score,
        coalesce(p.p_val, r.p_val) as conv_p_value,
        coalesce(p.significance, r.significance) as conv_significance,
        coalesce(p.details, r.details) as conv_details,
        -- Sample Ratio Mismatch check (not evaluated for date comparison, where the split is not randomized).
        bigquery_ab_analyzer.udf_srm_test(b.test_a, b.test_b, srm_expected_share_b, b.date_comparison) as srm
      from base b
      left join stats_prop p using (id)
      left join stats_rate r using (id)
      ),
      conv_seq as (
        select
          c.*,
          coalesce(c.target_sample, default_target_sample) as target_sample_used,
          least(1.0, safe_divide(c.test_a + c.test_b, coalesce(c.target_sample, default_target_sample))) as information_fraction,
          if(sequential_monitoring,
            bigquery_ab_analyzer.udf_sequential_alpha(
              c.confidence_level, c.hypothesis,
              least(1.0, safe_divide(c.test_a + c.test_b, coalesce(c.target_sample, default_target_sample)))),
            1 - c.confidence_level / 100) as sequential_alpha
        from conv_pre c
      ),
      conv as (
        -- A result is only SIGNIFICANT when its p-value is below today's sequential threshold.
        -- The threshold starts very strict and relaxes as the sample grows toward the target.
        select * replace (
          case
            when sequential_monitoring and conv_significance = 'SIGNIFICANT'
              and not coalesce(conv_p_value < sequential_alpha, false) then 'NOT_SIGNIFICANT'
            else conv_significance
          end as conv_significance,
          case
            when sequential_monitoring and conv_significance = 'SIGNIFICANT'
              and not coalesce(conv_p_value < sequential_alpha, false) then
              concat('No significant difference (',
                cast(cast(round(100 * information_fraction) as int64) as string),
                '% of target).')
            else conv_details
          end as conv_details
        ),
        -- Confidence interval for the relative lift (B vs A, 0.05 = +5%).
        bigquery_ab_analyzer.udf_lift_ci(
          conv_rate_a,
          if(is_rate_mode,
            bigquery_ab_analyzer.udf_zero_inflated_variance(test_a, converter_count_a, conversion_a, conversion_count_m2_a),
            conv_rate_a * (1 - conv_rate_a)),
          test_a,
          conv_rate_b,
          if(is_rate_mode,
            bigquery_ab_analyzer.udf_zero_inflated_variance(test_b, converter_count_b, conversion_b, conversion_count_m2_b),
            conv_rate_b * (1 - conv_rate_b)),
          test_b,
          ci_z
        ) as conv_lift_ci
        from (
          select
            *,
            -- Critical value matching today's significance threshold, so the interval excludes 0
            -- (approximately) exactly when the result is SIGNIFICANT. For one-sided tests the
            -- lower bound is the one that matches the test.
            bigquery_ab_analyzer.udf_normal_upper_quantile(
              if(lower(trim(coalesce(hypothesis, ''))) in ('one-sided', 'one sided', 'one_sided'),
                sequential_alpha, sequential_alpha / 2)) as ci_z
          from conv_seq
        )
      ),
      val as (
        -- value_per_participant = TRUE : n = all participants (non-converters count as 0).
        -- value_per_participant = FALSE: n = converting participants.
        -- Values are summed per participant before this point, so repeat purchases by one
        -- participant are never treated as independent observations.
        select
          ab.id,
          if(value_per_participant, ab.test_a, ab.converter_count_a) as n_value_a,
          if(value_per_participant, ab.test_b, ab.converter_count_b) as n_value_b,
          ab.total_conversion_value_a,
          ab.total_conversion_value_b,
          ab.converter_count_a,
          ab.converter_count_b,
          ab.conversion_value_m2_a,
          ab.conversion_value_m2_b,
          ab.hypothesis,
          ab.confidence_level,
          ab.analyze_test,
          ab.user_overlap
        from ab
        where ab.event_value_test = true
          and coalesce(ab.conversion_a, 0) > 0
          and coalesce(ab.conversion_b, 0) > 0
      ),
      val_stats as (
        select
          id,
          n_value_a,
          safe_divide(total_conversion_value_a, nullif(n_value_a, 0)) as mean_value_a,
          if(value_per_participant,
            bigquery_ab_analyzer.udf_zero_inflated_variance(n_value_a, converter_count_a, total_conversion_value_a, conversion_value_m2_a),
            safe_divide(conversion_value_m2_a, converter_count_a - 1)) as var_value_a,
          n_value_b,
          safe_divide(total_conversion_value_b, nullif(n_value_b, 0)) as mean_value_b,
          if(value_per_participant,
            bigquery_ab_analyzer.udf_zero_inflated_variance(n_value_b, converter_count_b, total_conversion_value_b, conversion_value_m2_b),
            safe_divide(conversion_value_m2_b, converter_count_b - 1)) as var_value_b,
          hypothesis,
          confidence_level
        from val
      ),
      val_result as (
        select
          v.id,
          v.n_value_a,
          v.var_value_a,
          v.n_value_b,
          v.var_value_b,
          r.metric_a as mean_value_a,
          r.metric_b as mean_value_b,
          r.stat as t_value,
          r.p_value as value_p_value,
          r.significance as value_significance,
          r.details as value_details
        from val_stats v
        cross join unnest([bigquery_ab_analyzer.udf_ab_count_welch(
          v.n_value_a,
          v.mean_value_a,
          v.var_value_a,
          v.n_value_b,
          v.mean_value_b,
          v.var_value_b,
          v.confidence_level,
          v.hypothesis
        )]) as r
      )
      select 
        conv.id,
        conv.date_start,
        conv.date_end,
        conv.experiment_name,
        conv.conversion_event,
        conv.scope,
        conv.identity_source,
        conv.hypothesis,
        conv.confidence_level,
        conv.analyze_test,
        conv.user_overlap,
        conv.date_comparison,
        conv.analyze_funnel,
        conv.test_a,
        conv.conversion_a,
        conv.test_b,
        conv.conversion_b,
        conv.conv_rate_a,
        conv.conv_rate_b,
        conv.conv_z_score,
        conv.conv_p_value,
        conv.conv_significance,
        conv.conv_details,
        conv.conversions_counting_mode,
        conv.srm.p_value as srm_p_value,
        conv.srm.status as srm_status,
        conv.total_conversion_value_a,
        conv.total_conversion_value_b,
        val_result.mean_value_a,
        val_result.mean_value_b,
        val_result.t_value,
        val_result.value_p_value,
        case
          when sequential_monitoring and val_result.value_significance = 'SIGNIFICANT'
            and not coalesce(val_result.value_p_value < conv.sequential_alpha, false) then 'NOT_SIGNIFICANT'
          else val_result.value_significance
        end as value_significance,
        case
          when val_result.value_details is null then 'Not tested'
          when sequential_monitoring and val_result.value_significance = 'SIGNIFICANT'
            and not coalesce(val_result.value_p_value < conv.sequential_alpha, false) then
            concat('No significant difference (',
              cast(cast(round(100 * conv.information_fraction) as int64) as string),
              '% of target).')
          else val_result.value_details
        end as value_details,
        conv.target_sample_used as target_sample,
        conv.information_fraction,
        conv.sequential_alpha,
        conv.conv_lift_ci.low as conv_lift_ci_low,
        conv.conv_lift_ci.high as conv_lift_ci_high,
        bigquery_ab_analyzer.udf_lift_ci(
          val_result.mean_value_a, val_result.var_value_a, val_result.n_value_a,
          val_result.mean_value_b, val_result.var_value_b, val_result.n_value_b, conv.ci_z).low as value_lift_ci_low,
        bigquery_ab_analyzer.udf_lift_ci(
          val_result.mean_value_a, val_result.var_value_a, val_result.n_value_a,
          val_result.mean_value_b, val_result.var_value_b, val_result.n_value_b, conv.ci_z).high as value_lift_ci_high,
        -- Warnings for set-ups where the test assumptions do not hold (results are still calculated).
        nullif(rtrim(concat(
          if(upper(trim(coalesce(conv.user_overlap, ''))) = 'CREDIT BOTH',
            'Credit Both: participants exposed to both variants are counted in both groups, so the groups are not independent and p-values are only approximate. ', ''),
          if(coalesce(conv.date_comparison, false),
            'Date comparison: the variants ran in different periods, so a difference can come from seasonality, campaigns or other changes, not only from the variant. ', ''),
          if(conv.srm.status = 'SRM_DETECTED',
            'Sample Ratio Mismatch: the traffic split differs from the expected split, so the results should not be trusted until the cause is found. ', '')
        )), '') as method_warning,
        current_date() as date_last_analyzed
      from conv
      left join val_result using (id)
    ) as source
    on T.id = source.id
    when matched then
      update set 
        date_start = source.date_start,
        date_end = source.date_end,
        experiment_name = source.experiment_name,
        conversion_event = source.conversion_event,
        scope = source.scope,
        identity_source = source.identity_source,
        hypothesis = source.hypothesis,
        confidence_level = source.confidence_level,
        analyze_test = source.analyze_test,
        user_overlap = source.user_overlap,
        date_comparison = source.date_comparison,
        analyze_funnel = source.analyze_funnel,
        test_a = source.test_a,
        conversion_a = source.conversion_a,
        test_b = source.test_b,
        conversion_b = source.conversion_b,
        conv_rate_a = source.conv_rate_a,
        conv_rate_b = source.conv_rate_b,
        conv_z_score = source.conv_z_score,
        conv_p_value = source.conv_p_value,
        conv_significance = source.conv_significance,
        conv_details = source.conv_details,
        conversions_counting_mode = source.conversions_counting_mode,
        srm_p_value = source.srm_p_value,
        srm_status = source.srm_status,
        target_sample = source.target_sample,
        information_fraction = source.information_fraction,
        sequential_alpha = source.sequential_alpha,
        conv_lift_ci_low = source.conv_lift_ci_low,
        conv_lift_ci_high = source.conv_lift_ci_high,
        value_lift_ci_low = source.value_lift_ci_low,
        value_lift_ci_high = source.value_lift_ci_high,
        method_warning = source.method_warning,
        total_conversion_value_a = source.total_conversion_value_a,
        total_conversion_value_b = source.total_conversion_value_b,
        mean_value_a = source.mean_value_a,
        mean_value_b = source.mean_value_b,
        t_value = source.t_value,
        value_p_value = source.value_p_value,
        value_significance = source.value_significance,
        value_details = source.value_details,
        date_last_analyzed = source.date_last_analyzed
    when not matched then
      insert (
        id, date_start, date_end, experiment_name, conversion_event, scope, identity_source,
        hypothesis, confidence_level, analyze_test, user_overlap, date_comparison, analyze_funnel,
        test_a, conversion_a, test_b, conversion_b, conv_rate_a, conv_rate_b, conv_z_score,
        conv_p_value, conv_significance, conv_details, conversions_counting_mode, srm_p_value, srm_status, target_sample, information_fraction, sequential_alpha, conv_lift_ci_low, conv_lift_ci_high, value_lift_ci_low, value_lift_ci_high, method_warning,
        total_conversion_value_a, total_conversion_value_b, mean_value_a, mean_value_b,
        t_value, value_p_value, value_significance, value_details, date_last_analyzed
      )
      values (
        source.id, source.date_start, source.date_end, source.experiment_name, source.conversion_event, source.scope, source.identity_source,
        source.hypothesis, source.confidence_level, source.analyze_test, source.user_overlap, source.date_comparison, source.analyze_funnel,
        source.test_a, source.conversion_a, source.test_b, source.conversion_b, source.conv_rate_a, source.conv_rate_b, source.conv_z_score,
        source.conv_p_value, source.conv_significance, source.conv_details, source.conversions_counting_mode, source.srm_p_value, source.srm_status, source.target_sample, source.information_fraction, source.sequential_alpha, source.conv_lift_ci_low, source.conv_lift_ci_high, source.value_lift_ci_low, source.value_lift_ci_high, source.method_warning,
        source.total_conversion_value_a, source.total_conversion_value_b, source.mean_value_a, source.mean_value_b,
        source.t_value, source.value_p_value, source.value_significance, source.value_details, source.date_last_analyzed
      );

    ----------------------------------------------------------------------------
    -- (9) BUFFER THE MERGE COST (DYNAMIC REGION)
    ----------------------------------------------------------------------------
    if query_info_logging then
      execute immediate format("""
        insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
        select
          active_exps.id,
          jobs.job_id,
          cast(jobs.total_bytes_billed / active_exps.exp_count as int64)
        from `%s`.INFORMATION_SCHEMA.JOBS_BY_USER as jobs
        cross join (
          select id, count(*) over() as exp_count 
          from (select distinct id from bigquery_ab_analyzer_query_information_buffer)
        ) as active_exps
        where jobs.job_id = @@last_job_id
      """, bq_region);
    end if;

    ----------------------------------------------------------------------------
    -- (10) GENERATE AI NARRATIVES
    ----------------------------------------------------------------------------
    if ai_summary_activated then
      -- Gemini sometimes refuses a request with "too many concurrent queries", even when nothing else
      -- is running. Such a refusal comes back at once, so try up to 3 times. If it still fails, keep the
      -- previous summaries and let the run succeed; the statistics are already saved.
      begin
        declare ai_attempt int64 default 0;
        declare ai_done bool default false;

        while not ai_done and ai_attempt < 3 do
          set ai_attempt = ai_attempt + 1;
          begin
            update `your_project.bigquery_ab_analyzer.experiments_report` dest
              set ai_summary = ai.ml_generate_text_llm_result
              from (
                select
                  id,
                  ml_generate_text_llm_result
                from ML.GENERATE_TEXT(
                  model `your_project.bigquery_ab_analyzer.gemini_narrator`,
                  (
                    select 
                      rep.id,
                      concat(
                        replace(ai_prompt, '{{TARGET_SAMPLE}}', cast(coalesce(exp.ai_total_target_sample, 2000) as string)),
                        '\n\nDATA:\n',
                        'Experiment Name: ', coalesce(rep.experiment_name, 'N/A'), '. ',
                        'Hypothesis: ', coalesce(rep.hypothesis, 'N/A'), '. ',
                        '--- EXPERIMENT METADATA --- ',
                        'Method Warnings: ', coalesce(rep.method_warning, 'None.'), ' ',
                        'Required Confidence Level: ', coalesce(cast(rep.confidence_level as string), 'N/A'), '%. ',
                        'Is Date Comparison Analysis?: ', coalesce(cast(rep.date_comparison as string), 'N/A'), '. ',
                        'Days Running: ', coalesce(cast(date_diff(rep.date_end, rep.date_start, day) + 1 as string), 'N/A'), ' days. ',
                        'Target Sample Size: ', cast(coalesce(exp.ai_total_target_sample, 2000) as string), '. ',
                        if(sequential_monitoring,
                          concat('Significance Method: sequential monitoring. Share of target sample collected: ',
                            coalesce(cast(cast(round(100 * rep.information_fraction) as int64) as string), 'N/A'),
                            '%. Current p-value threshold: ', case
                              when rep.sequential_alpha is null then 'N/A'
                              when rep.sequential_alpha < 0.0001 then '0.0001 or lower'
                              else format('%.4f', rep.sequential_alpha)
                            end,
                            '. SIGNIFICANT results are valid to act on now. '),
                          'Significance Method: fixed horizon (results are only valid at the target sample). '),
                        'Estimated Days Remaining to hit Target: ', 
                          coalesce(cast(
                            ceil(
                              greatest(0, coalesce(exp.ai_total_target_sample, 2000) - (rep.test_a + rep.test_b)) 
                              / 
                              nullif((rep.test_a + rep.test_b) / (date_diff(rep.date_end, rep.date_start, day) + 1), 0)
                            ) 
                        as string), 'N/A'), ' days. ',
                  
                        '--- SAMPLE SIZE --- ',
                        'Variant A Traffic: ', coalesce(cast(rep.test_a as string), '0'), ', ',
                        'Variant B Traffic: ', coalesce(cast(rep.test_b as string), '0'), '. ',
                        'Sample Ratio Mismatch Check: ', coalesce(rep.srm_status, 'N/A'),
                          ' (p-value ', if(rep.srm_p_value is null, 'N/A', format('%.4f', rep.srm_p_value)), '; SRM_DETECTED means the traffic split is broken and the results should not be trusted). ',
                        '--- CONVERSION RATE --- ',
                        'Variant A Rate: ', coalesce(cast(rep.conv_rate_a as string), 'N/A'), ', ',
                        'Variant B Rate: ', coalesce(cast(rep.conv_rate_b as string), 'N/A'), ', ',
                        'Rate Significant?: ', coalesce(cast(rep.conv_significance as string), 'N/A'), ', ',
                        'Conversion Z-Score: ', coalesce(format('%.4f', rep.conv_z_score), 'N/A'), ', ',
                        'Conversion P-Value: ', coalesce(format('%.4f', rep.conv_p_value), 'N/A'), '. ',
                        'Conversion Details: ', coalesce(rep.conv_details, 'N/A'), '. ',
                        'Conversion Lift Confidence Interval: ',
                          if(rep.conv_lift_ci_low is null, 'N/A',
                            format('%.1f%% to %.1f%%', 100 * rep.conv_lift_ci_low, 100 * rep.conv_lift_ci_high)), '. ',
                  
                        '--- VALUE --- ',
                        'Value Metric: ',
                          case
                            when nullif(trim(exp.value_parameter), '') is null then 'N/A'
                            when lower(trim(exp.value_parameter)) in ('items.quantity') then
                              'number of items, counting only items that match the item filters on the conversion event'
                            when lower(trim(exp.value_parameter)) in ('items.item_revenue', 'items.item_revenue_in_usd') then
                              'item revenue, counting only items that match the item filters on the conversion event'
                            when starts_with(lower(trim(exp.value_parameter)), 'items.') then
                              concat('the item field "', trim(exp.value_parameter), '", counting only items that match the item filters on the conversion event')
                            else concat('the "', trim(exp.value_parameter), '" parameter of the ', coalesce(rep.conversion_event, 'conversion'), ' event')
                          end, '. ',
                        'Variant A Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_a), 'N/A'), ', ',
                        'Variant B Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_b), 'N/A'), ', ',
                        'Variant A Value per Participant: ', if(rep.mean_value_a is null, 'N/A', format('%.2f', rep.mean_value_a)), ', ',
                        'Variant B Value per Participant: ', if(rep.mean_value_b is null, 'N/A', format('%.2f', rep.mean_value_b)), ', ',
                        'Variant A Value per Conversion: ', if(coalesce(rep.conversion_a, 0) = 0 or rep.total_conversion_value_a is null, 'N/A', format('%.2f', rep.total_conversion_value_a / rep.conversion_a)), ', ',
                        'Variant B Value per Conversion: ', if(coalesce(rep.conversion_b, 0) = 0 or rep.total_conversion_value_b is null, 'N/A', format('%.2f', rep.total_conversion_value_b / rep.conversion_b)), ', ',
                        'Value Significant?: ', coalesce(cast(rep.value_significance as string), 'N/A'), ', ',
                        'Value T-Value: ', coalesce(format('%.4f', rep.t_value), 'N/A'), ', ',
                        'Value P-Value: ', coalesce(format('%.4f', rep.value_p_value), 'N/A'), '. ',
                        'Value Details: ', coalesce(rep.value_details, 'N/A'), '. ',
                        'Value Lift Confidence Interval: ',
                          if(rep.value_lift_ci_low is null, 'N/A',
                            format('%.1f%% to %.1f%%', 100 * rep.value_lift_ci_low, 100 * rep.value_lift_ci_high)), '.\n\n',
                  
                        '\n\n--- FUNNEL JOURNEY DATA ---\n',
                        coalesce(funnel.funnel_text, 'No funnel tracking activated for this test.')
                      ) as prompt
                    from `your_project.bigquery_ab_analyzer.experiments_report` rep
                    join (
                      select id, max(ai_total_target_sample) as ai_total_target_sample, max(experiment_event_value_parameter) as value_parameter
                      from `your_project.bigquery_ab_analyzer.experiments`
                      where analyze_test = true
                        and analytics_tool = 'GOOGLE ANALYTICS' -- only this tool's experiments, so the tools never summarize the same rows
                      group by id
                    ) exp on rep.id = exp.id 
                    left join (
                      select 
                        id, 
                        string_agg(
                          format('Variant %s, Step %d (%s): %d users. Drop-off: %.1f%%. Median time: %.1f sec. Average time: %.1f sec.', 
                            variant, step_number, step_name, participants, 
                            coalesce(drop_off_rate_from_previous * 100, 0.0), 
                            coalesce(median_time_from_previous_sec, 0.0), 
                            coalesce(avg_time_from_previous_sec, 0.0)
                          ),
                          '\n' order by variant, step_number
                        ) as funnel_text
                      from `your_project.bigquery_ab_analyzer.experiments_funnel_report`
                      group by id
                    ) funnel on rep.id = funnel.id
                  ),
                  struct(
                    0.2 as temperature, 
                    4096 as max_output_tokens,
                    TRUE as flatten_json_output
                  )
                )
              ) as ai
              where dest.id = ai.id;

            ----------------------------------------------------------------------------
            -- (10b) BUFFER THE AI UPDATE COST (DYNAMIC REGION)
            ----------------------------------------------------------------------------
            if query_info_logging then
              execute immediate format("""
                insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
                select
                  active_exps.id,
                  jobs.job_id,
                  cast(jobs.total_bytes_billed / active_exps.exp_count as int64)
                from `%s`.INFORMATION_SCHEMA.JOBS_BY_USER as jobs
                cross join (
                  select id, count(*) over() as exp_count 
                  from (select distinct id from bigquery_ab_analyzer_query_information_buffer)
                ) as active_exps
                where jobs.job_id = @@last_job_id
              """, bq_region);
            end if;

            set ai_done = true;
          exception when error then
            if ai_attempt >= 3
              or not regexp_contains(lower(@@error.message), r'rate limit|quota|concurrent|resources exceeded|try again') then
              set ai_attempt = 3;
              select concat('AI summary skipped this run: ', @@error.message) as ai_summary_warning;
            end if;
          end;
        end while;
      end;
    end if;

    ----------------------------------------------------------------------------
    -- (11) FINAL SINGLE AGGREGATION
    ----------------------------------------------------------------------------
    if query_info_logging then
      insert into `your_project.bigquery_ab_analyzer.experiments_query_information` 
      (id, execution_time, job_ids, total_bytes_billed, estimated_cost_usd)
      select
        id,
        current_timestamp(),
        string_agg(job_id, ', '),
        sum(bytes_billed),
        cast((sum(bytes_billed) / 1099511627776) * query_price_per_tib as numeric)
      from bigquery_ab_analyzer_query_information_buffer
      where id is not null
      group by id;
    end if;

  end if;
end;
