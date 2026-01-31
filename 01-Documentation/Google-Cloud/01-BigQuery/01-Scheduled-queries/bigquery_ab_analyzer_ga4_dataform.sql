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
 * distributed under the License is distributed on an "as IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 ----------------------------------------------------------------------------
	-- Replace "your_project" with your project
	-- Replace "superform_outputs_XXX" with your data set

  -- CHECK REGION: Replace 'region-eu' with 'region-us' if your data is in USA
----------------------------------------------------------------------------

begin

  ----------------------------------------------------------------------------
  -- (0) Configuration & Variables
  ----------------------------------------------------------------------------
  declare events_table_name       string  default 'ga4_events'; 

  declare user_count              int64   default 0;
  declare conversion_count        int64   default 0;
  declare total_conversion_value  float64 default 0.0;
  declare total_conversion_sq_value float64 default 0.0;
  declare dyn_sql                 string  default "";
  declare exp_filter              string  default "";
  declare conv_filter             string  default "";
  declare id_expr                 string  default 'user_pseudo_id';
  declare id_predicate            string  default 'user_pseudo_id IS NOT NULL';
  declare id_filter               string  default '';
  declare conv_side_sql           string;
  declare value_expr              string  default 'null';
  
  declare sql_header string;
  declare sql_logic  string;
  declare sql_footer string;

  declare exposure_guard          string  default '';
  declare variant_key             string  default '';
  declare variant_col_path        string  default ''; 

  declare query_info_logging      bool default false;
  declare query_price_per_tib     float64;

  -- Validates if GA4 Dataform data exists
  declare is_ga4_dataform bool default (
    select count(*) > 0
    from `your_project.bigquery_ab_analyzer.experiments`
    where analyze_test = true
      and analytics_tool = 'GA4 DATAFORM'
  );

  if is_ga4_dataform then -- It's a GA4 Dataform query, run the query.

    -- Log query information
    set query_info_logging = (
      select count(*) > 0
      from `your_project.bigquery_ab_analyzer.experiments`
      where analyze_test = true
        and analytics_tool = 'GA4 DATAFORM'
        and query_information_logging = true
    );

    set query_price_per_tib = (
      select query_price_per_tib
      from `your_project.bigquery_ab_analyzer.experiments`
      where analyze_test = true
        and analytics_tool = 'GA4 DATAFORM'
        and query_information_logging = true
        and query_price_per_tib > 0
      limit 1
    );
  ----------------------------------------------------------------------------
  -- (1) Create TEMP table for results
  ----------------------------------------------------------------------------

    -- 1. Create a temporary buffer to hold costs while looping
    if query_info_logging then
      create temp table bigquery_ab_analyzer_query_information_buffer (
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

    ----------------------------------------------------------------------------
    -- (2) Main Loop: Process valid experiments for "GA4 DATAFORM"
    ----------------------------------------------------------------------------
    for rec in (
      select * from `your_project.bigquery_ab_analyzer.experiments`
      where analyze_test = true 
        and analytics_tool = 'GA4 DATAFORM' 
    ) do

      -- 2a) Identity Logic
      if rec.scope = "User" then
        if rec.identity_source = "USER_ID_ONLY" then
          set id_expr = "user_id";
          set id_predicate = "user_id is not null and user_id != ''";
          set id_filter = " and user_id is not null and user_id != ''";
        elseif rec.identity_source = "USER_ID_OR_DEVICE_ID" then
          set id_expr = "coalesce(nullif(user_id, ''), user_pseudo_id)";
          set id_predicate = "(user_id is not null and user_id != '' OR user_pseudo_id is not null)";
          set id_filter = ""; 
        else 
          set id_expr = "user_pseudo_id";
          set id_predicate = "user_pseudo_id is not null";
          set id_filter = "";
        end if;
      else
        -- Session Scope
        set id_expr = "user_pseudo_id";
        set id_predicate = "user_pseudo_id is not null";
        set id_filter = "";
      end if;

      set exp_filter = "";
      set conv_filter = "";

      -- 2b) Exposure Logic
      set variant_key = rec.experiment_variant_parameter;
    
      if strpos(variant_key, '.') = 0 then
        set variant_col_path = format("event_params.%s", variant_key);
      else
        set variant_col_path = variant_key;
      end if;

      set exposure_guard = format(" and event_name = '%s'", rec.experiment_event_name);

      -- 2c) Filters Logic
      for f in (
        select * from `your_project.bigquery_ab_analyzer.experiments_filters`
        where id = rec.id and variant = rec.variant
      ) do
        begin
          declare is_exclude bool default upper(f.filter_type) = 'EXCLUDE';
          declare check_sql string;
          declare full_field_path string;

          if f.filter_scope in ("Event", "Column") then
            
            -- Check if we are dealing with the nested items array
            if regexp_contains(f.filter_field, r'^items\.') then
              -- Sub-query logic for REPEATED RECORD
              -- We replace 'items.' with 'it.' to reference the unnested alias
              set check_sql = format("""
                exists (
                  select 1 from unnest(items) it 
                  where regexp_contains(safe_cast(%s as string), r'%s')
                )
              """, regexp_replace(f.filter_field, r'^items\.', 'it.'), f.filter_value);
              
            else
              -- Standard pathing for flat columns or event_params
              if strpos(f.filter_field, '.') = 0 then
                 set full_field_path = format("event_params.%s", f.filter_field);
              else
                 set full_field_path = f.filter_field;
              end if;

              set check_sql = format("regexp_contains(safe_cast(%s as string), r'%s')", 
                                     full_field_path, f.filter_value);
            end if;

            -- Append to the global filters for this variant
            if f.filter_on_value in ("Experiment Event", "Both") then
              set exp_filter = exp_filter || format(" and %s %s", if(is_exclude, "NOT", ""), check_sql);
            end if;

            if f.filter_on_value in ("Conversion Event", "Both") then
              set conv_filter = conv_filter || format(" and %s %s", if(is_exclude, "NOT", ""), check_sql);
            end if;
          end if;
        end;
      end for;

    set exp_filter = exp_filter || id_filter;
    set conv_filter = conv_filter || id_filter;

    -- 2d) Value Expression
    if starts_with(lower(rec.experiment_event_value_parameter), 'ecommerce.') then
        set value_expr = format("safe_cast(%s as float64)", rec.experiment_event_value_parameter);
    else
        if strpos(rec.experiment_event_value_parameter, '.') = 0 then
           set value_expr = format("safe_cast(event_params.%s as float64)", rec.experiment_event_value_parameter);
        else
           set value_expr = format("safe_cast(%s as float64)", rec.experiment_event_value_parameter);
        end if;
    end if;


    -- 2e) Build Conversion Side CTE
    -- Uses time.event_timestamp
    if rec.conversion_count_all then
      set conv_side_sql = format("""
        , conv_side as (
          select
            case when upper(trim('%s')) = 'USER' then %s
              else concat(user_pseudo_id, cast(event_params.ga_session_id as string))
            end as grouping_key,
            timestamp_micros(time.event_timestamp) as conv_time,
            %s as conv_value,
            pow(%s, 2) as conv_sq_value,
            1 as conv_count
          from all_events
          where event_date between '%s' and '%s'
          and event_name = '%s'
          %s
        )
      """, rec.scope, id_expr, value_expr, value_expr, 
            format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end),
            rec.conversion_event, conv_filter);
    else
      set conv_side_sql = format("""
        , conv_side as (
          select
            case when upper(trim('%s')) = 'USER' then %s
              else concat(user_pseudo_id, cast(event_params.ga_session_id as string))
            end as grouping_key,
            min(timestamp_micros(time.event_timestamp)) as conv_time,
            sum(%s) as conv_value,
            pow(sum(%s), 2) as conv_sq_value,
            1 as conv_count
          from all_events
          where event_date between '%s' and '%s'
            and event_name = '%s'
            %s
          group by grouping_key
        )
      """, rec.scope, id_expr, value_expr, value_expr,
            format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end),
            rec.conversion_event, conv_filter);
    end if;

    -- 3. Dynamic SQL Construction
    
    -- HEADER
    -- Uses superform_outputs dataset
    -- Uses time.event_timestamp
    set sql_header = format("""
      with all_events as (
        select *
        from `your_project.superform_outputs_XXX.%s`
        where event_date between '%s' and '%s'
      ),
      extracted as (
        select a.*,
          safe_cast(%s as string) as variant_value
        from all_events a
      ),
      exposures_all as (
        select
          case when upper(trim('%s')) = 'USER' then %s
            else concat(user_pseudo_id, cast(event_params.ga_session_id as string))
          end as grouping_key,
          timestamp_micros(time.event_timestamp) as exposure_time,
          trim(coalesce(variant_value,'')) as variant
        from extracted
        where event_date between '%s' and '%s'
          %s -- exposure_guard
          %s -- exp_filter
      ),
      exposures_labeled as (
        select grouping_key, exposure_time, variant
        from exposures_all
        where variant is not null and variant != ''
      )
    """, 
    events_table_name, format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end),
    variant_col_path, 
    rec.scope, id_expr,
    format_date('%Y-%m-%d', rec.date_start), format_date('%Y-%m-%d', rec.date_end),
    exposure_guard, exp_filter
    );

    -- FOOTER
    set sql_footer = format("""
      %s 
      , joined as (
        select
          e.grouping_key, e.exposure_time,
          c.conv_time, c.conv_value, c.conv_sq_value, c.conv_count
        from exposures_filtered e
        join conv_side c using (grouping_key)
        where c.conv_time >= e.exposure_time
      )
      select
        (select count(*) from exposures_filtered) as user_count,
        (select sum(conv_count) from joined) as conversion_count,
        (select sum(conv_value) from joined) as total_conversion_value,
        (select sum(conv_sq_value) from joined) as total_conversion_sq_value
    """, conv_side_sql);

    -- =======================================================================
    -- OVERLAP LOGIC (Modified for Dataform Header structure)
    -- =======================================================================
    
    if rec.user_overlap = "First Exposure" then
      set sql_logic = format("""
        , exposures_first as (
          select grouping_key, exposure_time, variant as variant_label
          from (
            select *, row_number() over (partition by grouping_key ORDER by exposure_time ASC) rn
            from exposures_labeled
          ) where rn = 1
        ),
        exposures_filtered as (
          select grouping_key, exposure_time
          from exposures_first
          where regexp_contains(trim(variant_label), r'%s')
        )
      """, rec.exp_variant_string);
      set dyn_sql = sql_header || sql_logic || sql_footer;

    elseif rec.user_overlap = "Last Exposure" then
      set sql_logic = format("""
        , exposures_last_ranked as (
           select 
             grouping_key, 
             variant, 
             exposure_time,
             -- Rank exposures by time descending (latest first)
             row_number() over (partition by grouping_key order by exposure_time desc) as rn
           from exposures_labeled
        ),
        exposures_filtered as (
           select 
             grouping_key, 
             exposure_time,
             -- Since this is the LAST exposure, it is valid forever
             timestamp('2099-12-31') as valid_until
           from exposures_last_ranked
           where rn = 1 -- Keep ONLY the very last variant this user saw
             and regexp_contains(trim(variant), r'%s')
        )
      """, rec.exp_variant_string);
      
      -- Custom footer for Last Exposure (Strict)
      set dyn_sql = sql_header || sql_logic || format("""
        %s 
        , joined as (
          select
            e.grouping_key, e.exposure_time,
            c.conv_time, c.conv_value, c.conv_sq_value, c.conv_count
          from exposures_filtered e
          join conv_side c using (grouping_key)
          where c.conv_time >= e.exposure_time
          -- No need to check valid_until because strict last exposure gets credit forever
        )
        select
          (select count(distinct grouping_key) from exposures_filtered) as user_count,
          (select sum(conv_count) from joined) as conversion_count,
          (select sum(conv_value) from joined) as total_conversion_value,
          (select sum(conv_sq_value) from joined) as total_conversion_sq_value
      """, conv_side_sql);

    elseif rec.user_overlap = "Exclude" then
      set sql_logic = format("""
        , user_variant_count as (
            select grouping_key, count(distinct variant) as variant_count
            from exposures_labeled group by grouping_key
        ),
        exposures_by_variant_first as (
            select grouping_key, variant, min(exposure_time) as exposure_time
            from exposures_labeled group by grouping_key, variant
        ),
        exposures_filtered as (
            select e.grouping_key, e.exposure_time
            from exposures_by_variant_first e
            join user_variant_count u using (grouping_key)
            where u.variant_count = 1
              and regexp_contains(trim(e.variant), r'%s')
        )
      """, rec.exp_variant_string);
      set dyn_sql = sql_header || sql_logic || sql_footer;

    elseif rec.user_overlap = "Credit Both" then
      set sql_logic = format("""
        , exposures_filtered as (
            select grouping_key, min(exposure_time) as exposure_time
            from exposures_labeled
            where regexp_contains(trim(variant), r'%s')
            group by grouping_key
        )
      """, rec.exp_variant_string);
      set dyn_sql = sql_header || sql_logic || sql_footer;

    else
      set dyn_sql = null;
    end if;

    -- Execute Dynamic SQL
    if dyn_sql is not null then
      execute immediate dyn_sql into user_count, conversion_count, total_conversion_value, total_conversion_sq_value;

        ----------------------------------------------------------------------------
        -- Stores 1 row per variant run
        -- CHECK REGION: Replace 'region-eu' with 'region-us' if your data is in USA
        ----------------------------------------------------------------------------
        if query_info_logging then
          insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
          select
            rec.id,
            job_id,
            total_bytes_billed
          from `region-eu`.INFORMATION_SCHEMA.JOBS_BY_USER
          where job_id = @@last_job_id;
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
  -- (4) FINAL MERGE: Update Report Table
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
          e.confidence, e.hypothesis, e.event_value_test, e.analyze_test, e.user_overlap, e.date_comparison, e.identity_source,
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
            -- validity for proportions test (once-per-user/session)
            ab.test_a > 0 and ab.test_b > 0
            and ab.conversion_a between 0 and ab.test_a
            and ab.conversion_b between 0 and ab.test_b as ok_prop,
            -- identify count-all mode
            (ab.conversions_counting_mode = 'Once per Event') as is_rate_mode
          from ab
        ),
        -- Only the rows where the proportions UDF is valid
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
        -- Only the rows where the rate test is valid
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
        b.test_a,
        b.conversion_a,
        b.test_b,
        b.conversion_b,
        b.conversions_counting_mode,
        -- Use whichever stats exist for this row
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
        source.mean_value_a,
        source.mean_value_b,
        source.t_value,
        source.value_p_value,
        source.value_significance,
        source.value_details,
        source.date_last_analyzed
      );

   ----------------------------------------------------------------------------
    -- (9) FINAL SINGLE INSERT (Includes Loop + Merge overhead)
    --     Adds the Merge job to the buffer, then sums everything up in one go.
    ----------------------------------------------------------------------------
    if query_info_logging then
    -- 1. Grab the cost of the Merge we just ran and add it to the buffer
      insert into bigquery_ab_analyzer_query_information_buffer (id, job_id, bytes_billed)
      select
        (select any_value(id) from bigquery_ab_analyzer_query_information_buffer), -- Attribute merge cost to the Experiment ID
        job_id,
        total_bytes_billed
      from `region-eu`.INFORMATION_SCHEMA.JOBS_BY_USER
      where job_id = @@last_job_id;

      -- 2. Aggregate everything into ONE SINGLE INSERT
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