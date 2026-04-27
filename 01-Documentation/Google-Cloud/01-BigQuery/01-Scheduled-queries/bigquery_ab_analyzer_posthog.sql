/**
 * Copyright 2026 Knowit AI & Analytics
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "as IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 ----------------------------------------------------------------------------
  -- Replace "your_project" with your actual project ID
  -- Replace "posthog" with your actual dataset
  -- CHECK REGION: Replace 'region-eu' with 'region-us' if your data is in US
----------------------------------------------------------------------------

-- We use a Temp Function to perfectly format BigQuery JSON paths. 
-- It uses standard dot notation ($.key) for normal text, and safely wraps special characters ($."$key").
create temp function format_bq_json_path(path_str string) returns string AS (
  (
    select concat('$', string_agg(
      if(regexp_contains(part, r'^[a-zA-Z_][a-zA-Z0-9_]*$'), concat('.', part), concat('."', part, '"')), ''
      order by offset
    ))
    from unnest(split(path_str, '.')) as part with offset
  )
);

begin

  ---------------------------------------------------------------------------
  -- (0) Top-level declarations
  ---------------------------------------------------------------------------
  declare user_count              int64   default 0;
  declare conversion_count        int64   default 0;
  declare total_conversion_value  float64 default 0.0;
  declare total_conversion_sq_value float64 default 0.0;
  
  declare dyn_sql                 string  default "";
  declare sql_header              string  default "";
  declare sql_logic               string  default "";
  declare sql_footer              string  default "";

  declare exp_filter              string  default "";
  declare conv_filter             string  default "";
  
  -- UPDATE THIS TO YOUR POSTHOG TABLE
  declare events_table            string  default 'your_project.posthog.events'; 
  
  declare id_expr                 string  default 'distinct_id';
  declare id_predicate            string  default "distinct_id is not null";
  declare id_filter               string  default '';
  declare conv_side_sql           string  default '';
  declare value_expr              string  default 'null';

  -- Funnel Add-on Variables
  declare funnel_json_str string default null;
  declare funnel_cte_sql string;
  declare funnel_select_sql string;
  declare funnel_steps_json json;
  declare num_steps int64;
  declare current_event string;
  declare current_param_key string;
  declare current_param_val string;
  declare clean_json_path string;
  declare param_filter string;
  declare union_string string;
  declare i int64;
  declare explicit_step int64;
  declare has_funnel_params bool;
  declare param_col_sql string;
  declare funnel_grouping string;

  declare exposure_guard          string  default '';
  declare variant_key             string  default '';
  declare test_variants_regex     string  default '';

  declare variant_json_path       string  default '';
  declare value_json_path         string  default '';

  declare has_variant_key         bool    default false;
  declare extracted_variant_expr  string  default 'null'; 
  declare where_variant_expr      string  default 'null'; 

  declare is_exclude              bool    default false;
  declare norm_path               string  default '';
  declare has_dot                 bool    default false;
  declare dotq_path               string  default '';
  declare json_prop_expr          string  default '';

  declare val_parent_key          string  default '';
  declare val_child_path          string  default '';
  declare val_q_parent            string  default '';
  declare val_q_child             string  default '';
  declare val_q_full              string  default '';

  declare query_info_logging      bool default false;
  declare query_price_per_tib     float64;

  declare ai_summary_activated    bool default false; 
  declare ai_prompt               string default '';

  -- CHECK FOR POSTHOG EXPERIMENTS
  declare is_posthog bool default (
    select exists(
      select 1 
      from `your_project.bigquery_ab_analyzer.experiments` 
      where analyze_test = true
        and analytics_tool = 'POSTHOG'
    )
  );

  if is_posthog then 

    set (
      query_info_logging,
      query_price_per_tib, 
      ai_summary_activated, 
      ai_prompt
    ) = (
      select as struct 
        query_information_logging,
        query_price_per_tib,
        ai_summary_activated,
        trim(ai_prompt)
      from `your_project.bigquery_ab_analyzer.settings`
    );
  
    if ai_prompt is null or ai_prompt = '' then
      set ai_prompt = concat(
        'You are an automated data reporting system writing a formal summary for an executive dashboard. ',
        'Write exactly 3 to 7 concise sentences summarizing the following A/B test results. Begin your output directly with the analytical summary. ',
        'Follow these rules strictly: ',
        '1. Winners & Significance: State if the test reached the Required Confidence Level. Declare the winner by explicitly quoting the findings in the "Conversion Details" or "Value Details" fields (e.g., state exactly how much better the winner performed). ',
        '2. Business Impact: If the test involves a "Mean Value", state the Total Value driven by each variant to provide scale. Treat "Total Value" as a unitless number (DO NOT add currency symbols). ',
        '3. Formatting: When citing statistical evidence, explicitly state whether you are referring to the "Conversion P-Value" or the "Value P-Value". Do not use scientific notation. Do not mention any metrics marked as N/A. ',
        '4. Sample Size Warning: The required total target sample size for this test is {{TARGET_SAMPLE}}. If the combined Total Sample Size (Variant A + Variant B) is less than this target, you MUST warn the audience about the high risk of a "false positive" (Type 1 error). ',
        '5. Underpowered Warning: If the total target size is set very low (below 1000), warn the audience that the test may be underpowered to reliably detect meaningful differences. ',
        '6. Duration & Conclusion Strategy: Look at the "Estimated Days Remaining". ',
        '-- If it is 0 days: State that the target sample size has been met and recommend concluding the test. ',
        '-- If it is between 1 and 30 days: Recommend letting the test run for that specific number of days. ',
        '-- If it is greater than 30 days: warn the audience that the site lacks sufficient daily traffic to reach statistical significance in a reasonable timeframe (under 30 days). ',
        '7. Funnel Bottlenecks: If "FUNNEL JOURNEY DATA" is provided, identify the specific step where the highest percentage of users drop off. Compare Variant A and Variant B to explain exactly WHERE the winning variant is outperforming the loser in the user journey. ',
        '8. Time Skew Analysis: If both "Median time" and "Average time" are provided for a funnel step, compare them. If the Average is significantly higher than the Median, explicitly state that a segment of users is delaying their action (e.g., leaving and returning later), creating a long-tail delay. ',
        '9. Output Structure: You MUST format your final response into exactly two paragraphs separated by a blank line. Paragraph 1: The main statistical summary. Paragraph 2: The Funnel & Time Skew analysis.'
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
      total_conversion_sq_value float64
    );

    ---------------------------------------------------------------------------
    -- (3) Loop over experiments
    ---------------------------------------------------------------------------
    for rec in (
      select
        id, variant, variant_name, date_start, date_end, experiment_event_name,       
        experiment_variant_parameter, exp_variant_string, conversion_event,            
        scope, identity_source, user_overlap, experiment_event_value_parameter,
        conversion_count_all, date_comparison, analyze_funnel, funnel_steps
      from `your_project.bigquery_ab_analyzer.experiments`
      where analyze_test = true
        and analytics_tool = 'POSTHOG' 
    ) do

    -------------------------------------------------------------------------
    -- Identity logic (PostHog)
    -------------------------------------------------------------------------
    if rec.scope = "User" then
      if rec.identity_source = "EXP_DEVICE_ID" then
        set id_expr = "json_value(properties, '$.exp_device_id')";
        set id_predicate = "json_value(properties, '$.exp_device_id') is not null and json_value(properties, '$.exp_device_id') != ''";
        set id_filter = "";
      else
        set id_expr = "distinct_id";
        set id_predicate = "distinct_id is not null and distinct_id != ''";
        set id_filter = "";
      end if;
    else
      -- Session scope using Triple Quotes for perfect literal mapping
      set id_expr = "distinct_id";
      set id_predicate = """distinct_id is not null and distinct_id != '' and json_value(properties, '$."$session_id"') is not null""";
      set id_filter = "";
    end if;

    set exp_filter  = "";
    set conv_filter = "";
    set sql_header = "";
    set sql_logic = "";
    set sql_footer = "";
    set dyn_sql = "";
    set test_variants_regex = coalesce((
      select string_agg(concat('(', coalesce(exp_variant_string, ''), ')'), '|')
      from `your_project.bigquery_ab_analyzer.experiments` 
      where id = rec.id and analyze_test = true and analytics_tool = 'POSTHOG'
    ), '.*');

    set variant_key = rec.experiment_variant_parameter;
    set exposure_guard = concat(" and event = '", rec.experiment_event_name, "'");

    set has_variant_key = length(trim(coalesce(variant_key,''))) > 0;

    -- VARIANT EXTRACTION (CLEAN JSON PATHS)
    if has_variant_key then
      set norm_path = trim(regexp_replace(trim(variant_key), r'\s*\.\s*', '.'), '.');
      set has_dot = regexp_contains(norm_path, r'\.');

      if has_dot then
        set val_parent_key = split(norm_path, '.')[offset(0)];
        set val_child_path = substr(norm_path, length(val_parent_key) + 2);

        set val_q_parent = format_bq_json_path(val_parent_key);
        set val_q_child = format_bq_json_path(val_child_path);
        set val_q_full = format_bq_json_path(norm_path);

        set extracted_variant_expr = concat(
          "coalesce(json_value(a.properties, '", val_q_full, "'), ",
          "(select json_value(_item, '", val_q_child, "') from unnest(json_extract_array(a.properties, '", val_q_parent, "')) as _item limit 1))"
        );

        set where_variant_expr = concat(
          "coalesce(json_value(properties, '", val_q_full, "'), ",
          "(select json_value(_item, '", val_q_child, "') from unnest(json_extract_array(properties, '", val_q_parent, "')) as _item limit 1))"
        );
      else
        set variant_json_path = format_bq_json_path(norm_path);
        set extracted_variant_expr = concat("json_value(a.properties, '", variant_json_path, "')");
        set where_variant_expr = concat("json_value(properties, '", variant_json_path, "')");
      end if;
    else
      set extracted_variant_expr = "null";
      set where_variant_expr = "null";
    end if;

    -------------------------------------------------------------------------
    -- Build filters
    -------------------------------------------------------------------------
    for f in (
      select filter_type, filter_on_value, filter_field, filter_value, filter_scope
      from `your_project.bigquery_ab_analyzer.experiments_filters`
      where id = rec.id and variant = rec.variant
    ) do
      set is_exclude = false;
      set norm_path = '';
      set has_dot = false;
      set dotq_path = '';
      set json_prop_expr = '';

      set is_exclude = upper(f.filter_type) = 'EXCLUDE';
      set norm_path = trim(regexp_replace(trim(f.filter_field), r'\s*\.\s*', '.'), '.');

      if norm_path != '' then
        set has_dot = regexp_contains(norm_path, r'\.');

        if upper(f.filter_scope) != 'COLUMN' then
           -- EVENT PROPERTY LOGIC
           if has_dot then
              set val_parent_key = split(norm_path, '.')[offset(0)];
              set val_child_path = substr(norm_path, length(val_parent_key) + 2);

              set val_q_parent = format_bq_json_path(val_parent_key);
              set val_q_child = format_bq_json_path(val_child_path);
              set val_q_full = format_bq_json_path(norm_path);

              set json_prop_expr = concat(
                "(regexp_contains(coalesce(json_value(properties, '", val_q_full, "'), ''), r'", f.filter_value, "') ",
                "OR exists(select 1 from unnest(json_extract_array(properties, '", val_q_parent, "')) as _item ",
                "where regexp_contains(coalesce(json_value(_item, '", val_q_child, "'), ''), r'", f.filter_value, "')))"
              );
           else
              set dotq_path = format_bq_json_path(norm_path);
              set json_prop_expr = concat("regexp_contains(coalesce(json_value(properties, '", dotq_path, "'), ''), r'", f.filter_value, "')");
           end if;

           if f.filter_on_value in ('Experiment Event','Both') then
             set exp_filter = exp_filter || concat(' and ', case when is_exclude then 'not ' else '' end, json_prop_expr);
           end if;
           if f.filter_on_value in ('Conversion Event','Both') then
             set conv_filter = conv_filter || concat(' and ', case when is_exclude then 'not ' else '' end, json_prop_expr);
           end if;
        else 
           -- COLUMN LOGIC 
           if f.filter_on_value in ('Experiment Event','Both') then
             set exp_filter = exp_filter || concat(' and ', case when is_exclude then 'not ' else '' end, "regexp_contains(coalesce(cast(", norm_path, " as string), ''), r'", f.filter_value, "')");
           end if;
           if f.filter_on_value in ('Conversion Event','Both') then
             set conv_filter = conv_filter || concat(' and ', case when is_exclude then 'not ' else '' end, "regexp_contains(coalesce(cast(", norm_path, " as string), ''), r'", f.filter_value, "')");
           end if;
        end if;
      end if; 
    end for;

    set exp_filter  = exp_filter  || id_filter;
    set conv_filter = conv_filter || id_filter;

    -------------------------------------------------------------------------
    -- Value expression
    -------------------------------------------------------------------------
    if rec.experiment_event_value_parameter is null or trim(rec.experiment_event_value_parameter) = '' then
      set value_expr = 'null';
    else
      set norm_path = trim(regexp_replace(trim(rec.experiment_event_value_parameter), r'\s*\.\s*', '.'), '.');
      set has_dot = regexp_contains(norm_path, r'\.');

      if has_dot then
        set val_parent_key = split(norm_path, '.')[offset(0)];
        set val_child_path = substr(norm_path, length(val_parent_key) + 2);

        set val_q_parent = format_bq_json_path(val_parent_key);
        set val_q_child = format_bq_json_path(val_child_path);
        set val_q_full = format_bq_json_path(norm_path);

        set value_expr = concat(
          "coalesce(",
            "safe_cast(json_value(properties, '", val_q_full, "') as float64), ",
            "(select sum(safe_cast(json_value(_item, '", val_q_child, "') as float64)) from unnest(json_extract_array(properties, '", val_q_parent, "')) as _item)",
          ")"
        );
      else
        set value_json_path = format_bq_json_path(norm_path);
        set value_expr = concat("safe_cast(json_value(properties, '", value_json_path, "') as float64)");
      end if;
    end if;

    -------------------------------------------------------------------------
    -- (4e) Conversion-side CTE 
    -------------------------------------------------------------------------
    set conv_side_sql = format("""
      , conv_side as (
        select
          case when upper(trim('%s')) = 'USER' then %s 
               else concat(distinct_id, coalesce(json_value(properties, '$."$session_id"'), '')) 
          end as grouping_key,
          timestamp as conv_time,
          %s as conv_value
        from `%s`
        where date(timestamp) between date '%s' and date '%s' 
          and %s and event = '%s' %s
      )
    """, coalesce(rec.scope, 'User'), id_expr, value_expr, events_table, format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end), id_predicate, coalesce(rec.conversion_event, ''), conv_filter);

    ----------------------------------------------------------------------------
    -- (NEW) POSTHOG FUNNEL CTEs
    ----------------------------------------------------------------------------
    set funnel_cte_sql = '';
    set funnel_select_sql = 'cast(null as string)';
      
    if coalesce(rec.analyze_funnel, false) = true and coalesce(rec.funnel_steps, '') != '' then
        
      set funnel_steps_json = parse_json(rec.funnel_steps);
      set num_steps = array_length(json_extract_array(rec.funnel_steps));
      set union_string = '';
      set i = 1;
        
      set has_funnel_params = (
        select count(1) > 0 
        from unnest(json_extract_array(rec.funnel_steps)) as f 
        where json_value(f, '$.param_key') is not null and trim(json_value(f, '$.param_key')) != ''
      );
        
      if has_funnel_params then
        set param_col_sql = ', properties';
      else
        set param_col_sql = '';
      end if;

      if upper(trim(coalesce(rec.scope, 'User'))) = 'SESSION' then
        set funnel_grouping = """concat(distinct_id, coalesce(json_value(properties, '$."$session_id"'), ''))""";
      else
        set funnel_grouping = id_expr;
      end if;
      
      -- 1. Base Funnel CTE
      set funnel_cte_sql = format("""
        , funnel_base as (
          select
            %s as grouping_key,
            event as event_name,
            timestamp as event_time
            %s
          from all_events
          where event in (
            select distinct json_value(step, '$.event') 
            from unnest(json_extract_array('%s')) as step
          )
        )
        , step_0 as (
          select grouping_key, exposure_time as t_0
          from exposures_filtered
        )
      """, funnel_grouping, param_col_sql, rec.funnel_steps);

      -- 2. Dynamically Generate the Cascaded Steps
      while i <= num_steps do
        set current_event = json_value(funnel_steps_json[i-1], '$.event');
        set current_param_key = json_value(funnel_steps_json[i-1], '$.param_key');
        set current_param_val = json_value(funnel_steps_json[i-1], '$.param_val');
        set explicit_step = coalesce(cast(json_value(funnel_steps_json[i-1], '$.step_number') as int64), i);
            
        set param_filter = '';
        if current_param_key is not null and current_param_val is not null then
          set clean_json_path = (select format_bq_json_path(current_param_key));

          set param_filter = format("""
            and regexp_contains(coalesce(json_value(f.properties, '%s'), ''), r'%s')
          """, clean_json_path, current_param_val);
        end if;

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
          """, i, i, i-1, current_event, i-1, param_filter);
              
          set union_string = union_string || format("SELECT %d as step_number, '%s' as step_name, count(t_%d) as participants, 0.0 as avg_time, 0.0 as median_time FROM step_%d\n", explicit_step, coalesce(current_param_val, current_event), i, i);
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
          """, i, i, i-1, current_event, i-1, param_filter, (select string_agg(cast(x as string), ', ') from unnest(generate_array(1, i+1)) as x));
              
          set union_string = union_string || format("UNION ALL\nSELECT %d as step_number, '%s' as step_name, count(t_%d) as participants, coalesce(avg(timestamp_diff(t_%d, t_%d, second)), 0.0) as avg_time, coalesce(approx_quantiles(timestamp_diff(t_%d, t_%d, second), 100)[offset(50)], 0.0) as median_time FROM step_%d\n", explicit_step, coalesce(current_param_val, current_event), i, i, i-1, i, i-1, i);
        end if;
            
        set i = i + 1;
      end while;

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

    -------------------------------------------------------------------------
    -- (4f) Universal Footer
    -------------------------------------------------------------------------
    if rec.conversion_count_all then
      set sql_footer = format("""
        %s
        %s
        , joined as (
          select
            e.grouping_key, 
            1 as conv_count, 
            coalesce(c.conv_value, 0) as conv_value, 
            pow(coalesce(c.conv_value, 0), 2) as conv_sq_value
          from exposures_filtered e
          join conv_side c using (grouping_key)
          where c.conv_time >= e.exposure_time
        )
        select
          (select count(distinct grouping_key) from exposures_filtered) as user_count,
          coalesce((select sum(conv_count) from joined), 0) as conversion_count,
          coalesce((select sum(conv_value) from joined), 0.0) as total_conversion_value,
          coalesce((select sum(conv_sq_value) from joined), 0.0) as total_conversion_sq_value,
          %s as funnel_json_str
      """, conv_side_sql, funnel_cte_sql, funnel_select_sql);
    else
      set sql_footer = format("""
        %s
        %s
        , joined_raw as (
          select e.grouping_key, coalesce(c.conv_value, 0) as conv_value
          from exposures_filtered e
          join conv_side c using (grouping_key)
          where c.conv_time >= e.exposure_time
        )
        , joined as (
          select 
            grouping_key, 
            1 as conv_count, 
            sum(conv_value) as conv_value, 
            pow(sum(conv_value), 2) as conv_sq_value
          from joined_raw 
          group by grouping_key
        )
        select
          (select count(distinct grouping_key) from exposures_filtered) as user_count,
          coalesce((select sum(conv_count) from joined), 0) as conversion_count,
          coalesce((select sum(conv_value) from joined), 0.0) as total_conversion_value,
          coalesce((select sum(conv_sq_value) from joined), 0.0) as total_conversion_sq_value,
          %s as funnel_json_str
      """, conv_side_sql, funnel_cte_sql, funnel_select_sql);
    end if;

    -------------------------------------------------------------------------
    -- (5) User overlap branches
    -------------------------------------------------------------------------
    if upper(trim(coalesce(rec.user_overlap, ''))) in ('FIRST EXPOSURE', 'LAST EXPOSURE', 'EXCLUDE') then
      set sql_header = format("""
        with all_events as (
          select *
          from `%s`
          where date(timestamp) between date '%s' and date '%s'
            and %s
        ),
        extracted as (
          select a.*, %s as variant_value
          from all_events a
        ),
        exposures_all as (
          select
            case when upper(trim('%s')) = 'USER' then %s
                 else concat(distinct_id, coalesce(json_value(properties, '$."$session_id"'), ''))
            end as grouping_key,
            timestamp as exposure_time,
            trim(coalesce(variant_value,'')) as variant
          from extracted
          where event = '%s'
            %s
        ),
        exposures_labeled as (
          select grouping_key, exposure_time, variant
          from exposures_all
          where variant is not null and variant != ''
        )
      """,
        events_table, format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end), id_predicate,
        extracted_variant_expr,
        coalesce(rec.scope, 'User'), id_expr,
        coalesce(rec.experiment_event_name, ''), exp_filter
      );
    end if;

    if upper(trim(coalesce(rec.user_overlap, ''))) = 'FIRST EXPOSURE' then
      set sql_logic = format("""
        , exposures_first as (
          select grouping_key, exposure_time, variant as variant_label
          from (
            select *, row_number() over (partition by grouping_key order by exposure_time asc) rn
            from exposures_labeled
            where regexp_contains(variant, r'%s')
          )
          where rn = 1
        ),
        exposures_filtered as (
          select grouping_key, exposure_time
          from exposures_first
          where regexp_contains(trim(variant_label), r'%s')
        )
      """, replace(test_variants_regex, '%', '%%'), replace(coalesce(rec.exp_variant_string, ''), '%', '%%'));
      set dyn_sql = sql_header || sql_logic || sql_footer;

    elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'LAST EXPOSURE' then
      set sql_logic = format("""
        , exposures_last_ranked as (
           select grouping_key, variant, exposure_time,
             row_number() over (partition by grouping_key order by exposure_time desc) as rn
           from exposures_labeled
           where regexp_contains(variant, r'%s')
        ),
        final_user_variant as (
           select grouping_key, variant
           from exposures_last_ranked
           where rn = 1 and regexp_contains(trim(variant), r'%s')
        ),
        exposures_filtered as (
           select e.grouping_key, min(e.exposure_time) as exposure_time
           from exposures_labeled e
           join final_user_variant f on e.grouping_key = f.grouping_key and e.variant = f.variant
           group by e.grouping_key
        )
      """, replace(test_variants_regex, '%', '%%'), replace(coalesce(rec.exp_variant_string, ''), '%', '%%'));
      set dyn_sql = sql_header || sql_logic || sql_footer;

    elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'EXCLUDE' then
      set sql_logic = format("""
        , user_variant_count as (
          select grouping_key, count(distinct variant) as variant_count
          from exposures_labeled
          where regexp_contains(variant, r'%s')
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
          where u.variant_count = 1
            and regexp_contains(trim(e.variant), r'%s')
        )
      """, replace(test_variants_regex, '%', '%%'), replace(coalesce(rec.exp_variant_string, ''), '%', '%%'));
      set dyn_sql = sql_header || sql_logic || sql_footer;

    elseif upper(trim(coalesce(rec.user_overlap, ''))) = 'CREDIT BOTH' then
      set dyn_sql = format("""
        with all_events as (
          select *
          from `%s`
          where date(timestamp) between date '%s' and date '%s'
            and %s
        ),
        exposures_filtered as (
          select
            case when upper(trim('%s')) = 'USER' then %s
                 else concat(distinct_id, coalesce(json_value(properties, '$."$session_id"'), ''))
            end as grouping_key,
            min(timestamp) as exposure_time
          from all_events
          where event = '%s'
            and regexp_contains(coalesce(%s, ''), r'%s')
            %s
          group by grouping_key
        )
      """,
        events_table, format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end), id_predicate,
        coalesce(rec.scope, 'User'), id_expr,
        coalesce(rec.experiment_event_name, ''), where_variant_expr, replace(coalesce(rec.exp_variant_string, ''), '%', '%%'), exp_filter
      );
      set dyn_sql = dyn_sql || sql_footer;

    else
      set dyn_sql = null;
    end if;

    -------------------------------------------------------------------------
    -- (6) Execute
    -------------------------------------------------------------------------
    if dyn_sql is not null and length(dyn_sql) > 0 then
      execute immediate dyn_sql into user_count, conversion_count, total_conversion_value, total_conversion_sq_value, funnel_json_str;

        if query_info_logging then
          insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
          select rec.id, job_id, total_bytes_billed
          from `region-eu`.INFORMATION_SCHEMA.JOBS_BY_USER
          where job_id = @@last_job_id;
        end if;

        -- Funnel Insert Logic
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
        date_start, date_end, user_count, conversion_count, total_conversion_value, total_conversion_sq_value
      )
      values (
        rec.id, rec.variant, rec.variant_name, rec.conversion_event, rec.scope, rec.user_overlap,
        rec.date_start, rec.date_end, user_count, conversion_count, total_conversion_value, total_conversion_sq_value
      );
    end if;

  end for;
    
    ----------------------------------------------------------------------------
    -- (7) Final pivot + merge
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

          max(if(r.variant = 'A', r.conversion_event, null)) as conv_event_a,
          max(if(r.variant = 'B', r.conversion_event, null)) as conv_event_b,

          e.confidence as confidence_level,
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
      conv as (
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
          select
            b.id,
            r.rate_a, r.rate_b, r.z_val, r.p_val, r.significance, r.details
          from valid_rate b
          cross join unnest([bigquery_ab_analyzer.udf_ab_rate_test(
            b.test_a, b.conversion_a,
            b.test_b, b.conversion_b,
            b.confidence_level, b.hypothesis
          )]) as r
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
        b.conversions_counting_mode,
        b.total_conversion_value_a,
        b.total_conversion_value_b,
        coalesce(p.rate_a, r.rate_a) as conv_rate_a,
        coalesce(p.rate_b, r.rate_b) as conv_rate_b,
        coalesce(p.z_val, r.z_val) as conv_z_score,
        coalesce(p.p_val, r.p_val) as conv_p_value,
        coalesce(p.significance, r.significance) as conv_significance,
        coalesce(p.details, r.details) as conv_details
      from base b
      left join stats_prop p using (id)
      left join stats_rate r using (id)
      ),
      val as (
        select
          ab.id,
          ab.conversion_a as n_a_value,
          safe_divide(ab.total_conversion_value_a, nullif(ab.conversion_a,0)) as mean_value_a,
          safe_divide(ab.total_conversion_sq_value_a - safe_divide(pow(ab.total_conversion_value_a, 2), ab.conversion_a), ab.conversion_a - 1) as var_value_a,
          ab.conversion_b as n_b_value,
          safe_divide(ab.total_conversion_value_b, nullif(ab.conversion_b,0)) as mean_value_b,
          safe_divide(ab.total_conversion_sq_value_b - safe_divide(pow(ab.total_conversion_value_b, 2), ab.conversion_b), ab.conversion_b - 1) as var_value_b,
          ab.hypothesis,
          ab.confidence_level,
          ab.analyze_test,
          ab.user_overlap
        from ab
        where ab.event_value_test = true
          and coalesce(ab.conversion_a, 0) > 0
          and coalesce(ab.conversion_b, 0) > 0
      ),
      val_result as (
        select
          v.id,
          r.metric_a as mean_value_a,
          r.metric_b as mean_value_b,
          r.stat as t_value,
          r.p_value as value_p_value,
          r.significance as value_significance,
          r.details as value_details
        from val v
        cross join unnest([bigquery_ab_analyzer.udf_ab_count_welch(
          v.n_a_value,
          v.mean_value_a,
          v.var_value_a,
          v.n_b_value,
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
        conv.total_conversion_value_a,
        conv.total_conversion_value_b,
        val_result.mean_value_a,
        val_result.mean_value_b,
        val_result.t_value,
        val_result.value_p_value,
        val_result.value_significance,
        if(val_result.value_details is null, 'Not tested', val_result.value_details) AS value_details,
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
          id,
          date_start,
          date_end,
          experiment_name,
          conversion_event,
          scope,
          identity_source,
          hypothesis,
          confidence_level,
          analyze_test,
          user_overlap,
          date_comparison,
          analyze_funnel,
          test_a,
          conversion_a,
          test_b,
          conversion_b,
          conv_rate_a,
          conv_rate_b,
          conv_z_score,
          conv_p_value,
          conv_significance,
          conv_details,
          conversions_counting_mode,
          total_conversion_value_a,
          total_conversion_value_b,
          mean_value_a,
          mean_value_b,
          t_value,
          value_p_value,
          value_significance,
          value_details,
          date_last_analyzed
        )
        values (
          source.id,
          source.date_start,
          source.date_end,
          source.experiment_name,
          source.conversion_event,
          source.scope,
          source.identity_source,
          source.hypothesis,
          source.confidence_level,
          source.analyze_test,
          source.user_overlap,
          source.date_comparison,
          source.analyze_funnel,
          source.test_a,
          source.conversion_a,
          source.test_b,
          source.conversion_b,
          source.conv_rate_a,
          source.conv_rate_b,
          source.conv_z_score,
          source.conv_p_value,
          source.conv_significance,
          source.conv_details,
          source.conversions_counting_mode,
          source.total_conversion_value_a,
          source.total_conversion_value_b,
          source.mean_value_a,
          source.mean_value_b,
          source.t_value,
          source.value_p_value,
          source.value_significance,
          source.value_details,
          source.date_last_analyzed
        );

    ----------------------------------------------------------------------------
    -- (9) BUFFER THE MERGE COST
    ----------------------------------------------------------------------------
    if query_info_logging then
      insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
      select
        active_exps.id,
        jobs.job_id,
        cast(jobs.total_bytes_billed / active_exps.exp_count as int64)
      from `region-eu`.INFORMATION_SCHEMA.JOBS_BY_USER as jobs
      cross join (
        select id, count(*) over() as exp_count 
        from (select distinct id from bigquery_ab_analyzer_query_information_buffer)
      ) as active_exps
      where jobs.job_id = @@last_job_id;
    end if;

    ----------------------------------------------------------------------------
    -- (10) GENERATE AI NARRATIVES
    ----------------------------------------------------------------------------
    if ai_summary_activated then
      update `your_project.bigquery_ab_analyzer.experiments_report` dest
        set ai_summary = JSON_VALUE(ai.ml_generate_text_result, '$.candidates[0].content.parts[0].text')
        from (
          select
            id,
            ml_generate_text_result
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
                  'Required Confidence Level: ', coalesce(cast(rep.confidence_level as string), 'N/A'), '%. ',
                  'Is Date Comparison Analysis?: ', coalesce(cast(rep.date_comparison as string), 'N/A'), '. ',
                  'Days Running: ', coalesce(cast(date_diff(rep.date_end, rep.date_start, day) + 1 as string), 'N/A'), ' days. ',
                  'Target Sample Size: ', cast(coalesce(exp.ai_total_target_sample, 2000) as string), '. ',
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
                  '--- CONVERSION RATE --- ',
                  'Variant A Rate: ', coalesce(cast(rep.conv_rate_a as string), 'N/A'), ', ',
                  'Variant B Rate: ', coalesce(cast(rep.conv_rate_b as string), 'N/A'), ', ',
                  'Rate Significant?: ', coalesce(cast(rep.conv_significance as string), 'N/A'), ', ',
                  'Conversion Z-Score: ', coalesce(format('%.4f', rep.conv_z_score), 'N/A'), ', ',
                  'Conversion P-Value: ', coalesce(format('%.4f', rep.conv_p_value), 'N/A'), '. ',
                  'Conversion Details: ', coalesce(rep.conv_details, 'N/A'), '. ',
                  
                  '--- MEAN VALUE & TOTAL VALUE --- ',
                  'Variant A Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_a), 'N/A'), ', ',
                  'Variant B Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_b), 'N/A'), ', ',
                  'Variant A Mean Value: ', coalesce(format('%.2f', rep.mean_value_a), 'N/A'), ', ',
                  'Variant B Mean Value: ', coalesce(format('%.2f', rep.mean_value_b), 'N/A'), ', ',
                  'Value Significant?: ', coalesce(cast(rep.value_significance as string), 'N/A'), ', ',
                  'Value T-Value: ', coalesce(format('%.4f', rep.t_value), 'N/A'), ', ',
                  'Value P-Value: ', coalesce(format('%.4f', rep.value_p_value), 'N/A'), '. ',
                  'Value Details: ', coalesce(rep.value_details, 'N/A'), '.\n\n',
                  
                  '--- FUNNEL JOURNEY DATA ---\n',
                  coalesce(funnel.funnel_text, 'No funnel tracking activated for this test.')
                ) as prompt
              from `your_project.bigquery_ab_analyzer.experiments_report` rep
              join (
                select id, max(ai_total_target_sample) as ai_total_target_sample
                from `your_project.bigquery_ab_analyzer.experiments`
                where analyze_test = true group by id
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
              400 as max_output_tokens
            )
          )
        ) as ai
        where dest.id = ai.id;

      ----------------------------------------------------------------------------
      -- (10b) BUFFER THE AI UPDATE COST (BigQuery bytes only)
      ----------------------------------------------------------------------------
      if query_info_logging then
        insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
      select
        active_exps.id,
        jobs.job_id,
        cast(jobs.total_bytes_billed / active_exps.exp_count as int64)
      from `region-eu`.INFORMATION_SCHEMA.JOBS_BY_USER as jobs
      cross join (
        select id, count(*) over() as exp_count 
        from (select distinct id from bigquery_ab_analyzer_query_information_buffer)
      ) as active_exps
      where jobs.job_id = @@last_job_id;
      end if;
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