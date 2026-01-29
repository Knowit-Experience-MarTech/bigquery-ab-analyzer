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

const timeToLiveDays = 1; // Number of days staging (staging) tables should "live".

/** Read & normalize the selected analytics tool. */
function getAnalyticsTool() {
  const v = readNamed('SettingsAnalyticsTool', 'Google Analytics');
  return String(v || '').trim();
}

function confirmQueries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);
  const lastRow = sheet.getLastRow();

  let yesCount = 0;
  let updateCount = 0;
  let noCount = 0;

  let minDate = null;
  let maxDate = null;

  // helper
  function considerDate(d) {
    if (!d || !(d instanceof Date) || isNaN(d)) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  // Walk 2-row blocks
  for (let r = firstRow; r <= lastRow; r += 2) {
    const r2 = r + 1;
    if (r2 > lastRow) break;

    const analyzeRaw = String(sheet.getRange(r, analyzeTestColumn).getValue() || "").trim().toLowerCase();
    if (analyzeRaw === "yes") {
      yesCount++;

      // Compute date span only from "Yes" blocks
      const isCompared = !!sheet.getRange(r, dateComparisonColumn).getValue();
      if (isCompared) {
        // Top row (A)
        considerDate(new Date(sheet.getRange(r, dateStartColumn).getValue()));
        considerDate(new Date(sheet.getRange(r, dateEndColumn).getValue()));
        // Bottom row (B)
        considerDate(new Date(sheet.getRange(r2, dateStartColumn).getValue()));
        considerDate(new Date(sheet.getRange(r2, dateEndColumn).getValue()));
      } else {
        // Single merged date range from the top row
        considerDate(new Date(sheet.getRange(r, dateStartColumn).getValue()));
        considerDate(new Date(sheet.getRange(r, dateEndColumn).getValue()));
      }

    } else if (analyzeRaw === "update") {
      updateCount++;
    } else {
      noCount++;
    }
  }

  if (yesCount === 0 && updateCount === 0) {
    SpreadsheetApp.getUi().alert(
      'Nothing to export',
      'No experiments are marked as "Yes" or "Update".',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const tz = ss.getSpreadsheetTimeZone();
  const dateSpan =
    minDate && maxDate
      ? ` covering ${Utilities.formatDate(minDate, tz, "yyyy-MM-dd")} to ${Utilities.formatDate(maxDate, tz, "yyyy-MM-dd")}`
      : "";

  let message = "";
  if (yesCount > 0 && updateCount === 0) {
    // Only Yes
    message =
      `You are about to execute ${yesCount} analysis ${yesCount === 1 ? "query" : "queries"}${dateSpan}. ` +
      `This may incur BigQuery costs.\n\n` +
      (noCount > 0 ? `${noCount} experiment${noCount === 1 ? "" : "s"} marked "No" will be synced as Analyze = FALSE.\n\n` : "") +
      `Do you want to proceed?`;
  } else if (yesCount === 0 && updateCount > 0) {
    // Only Update
    message =
      `You are about to update metadata for ${updateCount} experiment${updateCount === 1 ? "" : "s"} (Analyze = "Update").\n` +
      `No analysis queries will run; this only upserts descriptive fields (names, description, links, images).\n\n` +
      (noCount > 0 ? `${noCount} experiment${noCount === 1 ? "" : "s"} marked "No" will be synced as Analyze = FALSE.\n\n` : "") +
      `Do you want to proceed?`;
  } else {
    // Mixed Yes + Update
    message =
      `You are about to execute ${yesCount} analysis ${yesCount === 1 ? "query" : "queries"}${dateSpan}, ` +
      `and update metadata for ${updateCount} experiment${updateCount === 1 ? "" : "s"}.\n` +
      `This may incur BigQuery costs.\n\n` +
      (noCount > 0 ? `${noCount} experiment${noCount === 1 ? "" : "s"} marked "No" will be synced as Analyze = FALSE.\n\n` : "") +
      `Do you want to proceed?`;
  }

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert("Confirm Export", message, ui.ButtonSet.YES_NO);
  if (response === ui.Button.YES) {
    exportExperimentsToBigQuery();
  } else {
    ui.alert("Export canceled.");
  }
}

/*********************************************************
 * MAIN EXPORT FUNCTION: BUILD CSV, LOAD WITH WRITE_TRUNCATE
 *********************************************************/
function exportExperimentsToBigQuery() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);

  // 1) Read BigQuery settings from named ranges.
  const projectId  = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId  = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const datasetLoc = ss.getRangeByName("SettingsBigQueryDataSetLocation").getValue();
  const tableId = ss.getRangeByName("SettingsBigQueryExperimentTable").getValue();
  const reportsTable = ss.getRangeByName("SettingsBigQueryReportingTable").getValue();

  // 2) Ensure the dataset exists (create if missing)
  ensureDatasetWithLocation(projectId, datasetId, datasetLoc);

  const flat = flatten2RowBlocks(sheet); // now emits Yes+Update rows and export_mode
  const rows = flat.valid;
  if (flat.skipped.length) {
    SpreadsheetApp.getUi().alert("Some experiments were skipped:\n\n" + flat.skipped.join("\n"));
  }
  if (!rows.length) return "No experiment rows to export.";

  const cols = [
    "id","variant","date_start","date_end","date_comparison",
    "experiment_name","variant_name","conversion_event","conversion_count_all","exp_variant_string",
    "analyze_test","event_value_test","hypothesis","confidence","description",
    "scope","identity_source","experiment_event_name","experiment_variant_parameter",
    "experiment_event_value_parameter","user_overlap",
    "export_mode", "analytics_tool", "query_information_logging", "query_price_per_tib"
  ];
  const csv = rows.map(r => cols.map(c => toCsvCell(r[c])).join(",")).join("\n");
  const blob = Utilities.newBlob(csv, "application/octet-stream", "experiments_stage.csv");

  const stage = tableId + "_stage";

  // Load STAGING (truncate staging only)
  const loadJob = {
    configuration: { load: {
      destinationTable: { projectId, datasetId, tableId: stage },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      schema: { fields: [
        { name: "id", type: "STRING" },
        { name: "variant", type: "STRING" },
        { name: "date_start", type: "DATE" },
        { name: "date_end", type: "DATE" },
        { name: "date_comparison", type: "BOOL" },
        { name: "experiment_name", type: "STRING" },
        { name: "variant_name", type: "STRING" },
        { name: "conversion_event", type: "STRING" },
        { name: "conversion_count_all", type: "BOOL" },
        { name: "exp_variant_string", type: "STRING" },
        { name: "analyze_test", type: "BOOL" },
        { name: "event_value_test", type: "BOOL" },
        { name: "hypothesis", type: "STRING" },
        { name: "confidence", type: "INT64" },
        { name: "description", type: "STRING" },
        { name: "scope", type: "STRING" },
        { name: "identity_source", type: "STRING" },
        { name: "experiment_event_name", type: "STRING" },
        { name: "experiment_variant_parameter", type: "STRING" },
        { name: "experiment_event_value_parameter", type: "STRING" },
        { name: "user_overlap", type: "STRING" },
        { name: "export_mode", type: "STRING" },
        { name: "analytics_tool", type: "STRING" },
        { name: "query_information_logging", type: "BOOL" },
        { name: "query_price_per_tib", type: "FLOAT64" }
      ]}
    }}
  };

  // MERGE staging -> main
  const t = `\`${projectId}.${datasetId}.${tableId}\``;
  const s = `\`${projectId}.${datasetId}.${stage}\``;
  const merge = `
  MERGE ${t} T
  USING (
    SELECT * FROM ${s}
    WHERE id IS NOT NULL AND id != '' AND variant IN ('A','B')
  ) S
  ON T.id = S.id AND T.variant = S.variant
  WHEN MATCHED AND UPPER(TRIM(S.export_mode)) = 'ANALYZE' THEN UPDATE SET
    date_start = S.date_start,
    date_end = S.date_end,
    date_comparison = S.date_comparison,
    experiment_name = S.experiment_name,
    variant_name = S.variant_name,
    conversion_event = S.conversion_event,
    conversion_count_all = S.conversion_count_all,
    exp_variant_string = S.exp_variant_string,
    analyze_test = S.analyze_test,
    event_value_test = S.event_value_test,
    hypothesis = S.hypothesis,
    confidence = S.confidence,
    description = S.description,
    scope = S.scope,
    identity_source = S.identity_source,
    experiment_event_name = S.experiment_event_name,
    experiment_variant_parameter = S.experiment_variant_parameter,
    experiment_event_value_parameter= S.experiment_event_value_parameter,
    user_overlap = S.user_overlap,
    analytics_tool = S.analytics_tool,
    query_information_logging = S.query_information_logging,
    query_price_per_tib = S.query_price_per_tib
  WHEN MATCHED AND UPPER(TRIM(S.export_mode)) = 'UPDATE' THEN UPDATE SET
    experiment_name = S.experiment_name,
    variant_name = S.variant_name,
    description = S.description,
    analytics_tool = S.analytics_tool,
    analyze_test = FALSE
  WHEN MATCHED AND UPPER(TRIM(S.export_mode)) = 'STATUS_ONLY' THEN UPDATE SET
    analyze_test = FALSE
  WHEN NOT MATCHED BY TARGET AND UPPER(TRIM(S.export_mode)) = 'ANALYZE' THEN INSERT (
    id,variant,date_start,date_end,date_comparison,experiment_name,variant_name,
    conversion_event,conversion_count_all, exp_variant_string,analyze_test,event_value_test,hypothesis,confidence,
    description,scope,identity_source,experiment_event_name,experiment_variant_parameter,
    experiment_event_value_parameter,user_overlap, analytics_tool, query_information_logging, query_price_per_tib
  ) VALUES (
    S.id,S.variant,S.date_start,S.date_end,S.date_comparison,S.experiment_name,S.variant_name,
    S.conversion_event, S.conversion_count_all, S.exp_variant_string,S.analyze_test,S.event_value_test,S.hypothesis,S.confidence,
    S.description,S.scope,S.identity_source,S.experiment_event_name,S.experiment_variant_parameter,
    S.experiment_event_value_parameter,S.user_overlap, S.analytics_tool, S.query_information_logging, S.query_price_per_tib
  )`;

  // Kick the related exports
  const filtersStatus = exportExperimentFiltersToBigQueryCSVLoad();
  const imagesStatus = exportExperimentImagesToBigQueryCSVLoad();
  const linksStatus = exportExperimentLinksToBigQueryCSVLoad();

  const loadRes = BigQuery.Jobs.insert(loadJob, projectId, blob);
  waitForJobDone(projectId, loadRes.jobReference.jobId, 'load experiments_stage');
  setTableTimeToLive(projectId, datasetId, stage, timeToLiveDays);

  runQuery(projectId, merge, 'MERGE experiments');

  // Sync experiment_name into experiments_report
  const r = `\`${projectId}.${datasetId}.${reportsTable}\``;
  const syncNames = `
    UPDATE ${r} R
    SET experiment_name = S.experiment_name
    FROM ${s} S
    WHERE R.id = S.id
      AND UPPER(TRIM(S.export_mode)) = 'UPDATE'
      AND S.variant = 'A'
  `;
  runQuery(projectId, syncNames, 'SYNC experiments_report.experiment_name');

  // Build a user-friendly summary
  const expSummary = summarizeExperimentExport(rows);

  // Include the unique experiment count that actually changed
  const expVariantRows = rows.length; // A+B rows that hit staging

  const parts = [];
  parts.push('Export complete ✅');

  if (expSummary.analyzed > 0) {
    parts.push(`• Analyzed: ${expSummary.analyzed} experiment${pluralize(expSummary.analyzed)} (variants upserted to staging: ${expVariantRows}).`);
  }
  if (expSummary.updated > 0) {
    parts.push(`• Metadata updated: ${expSummary.updated} experiment${pluralize(expSummary.updated)} (names/description/links/images only).`);
  }
  if (expSummary.no > 0) {
    parts.push(`• Synced Analyze = FALSE: ${expSummary.no} experiment${pluralize(expSummary.no)}.`);
  }

  // Keep the per-table status lines:
  parts.push(imagesStatus);
  parts.push(linksStatus);
  parts.push(filtersStatus);

  SpreadsheetApp.getUi().alert(parts.join('\n'));
}

/***********************************************************
 * FLATTEN FUNCTION: 2-ROW BLOCKS WITH DATE COMPARISON SUPPORT
 * E and G are unmerged, crucial in BOTH rows
 * A,D,F,H,I,J,K,L,M are merged from top row only
 * If dateComparisonColumn (col D) is checked:
 *   - Variant A uses dates from top row (r)
 *   - Variant B uses dates from bottom row (r+1)
 *   - date_comparison = true for both rows
 * If unchecked:
 *   - Both variants use dates from top row (r)
 *   - date_comparison = false for both rows
 ***********************************************************/
function flatten2RowBlocks(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const columnIdTitle = ss.getRangeByName("ColumnIdTitle").getValue();
  const columnDateStartTitle = ss.getRangeByName("ColumnDateStartTitle").getValue();
  const columnDateEndTitle = ss.getRangeByName("ColumnDateEndTitle").getValue();
  const columnExperimentNameTitle = ss.getRangeByName("ColumnExperimentNameTitle").getValue();
  const columnVariantNameTitle = ss.getRangeByName("ColumnVariantNameTitle").getValue();
  const columnConversionEventTitle = ss.getRangeByName("ColumnConversionEventTitle").getValue();
  const columnExperimentVariantStringTitle = ss.getRangeByName("ColumnExperimentVariantStringTitle").getValue();
  const columnAnalyzeTitle = ss.getRangeByName("ColumnAnalyzeTitle").getValue();
  const columnEventValueTestTitle = ss.getRangeByName("ColumnEventValueTestTitle").getValue();
  const columnHypothesisTitle = ss.getRangeByName("ColumnHypothesisTitle").getValue();
  const columnConfidenceTitle = ss.getRangeByName("ColumnConfidenceTitle").getValue();
  const columnDescriptionTitle = ss.getRangeByName("ColumnDescriptionTitle").getValue();
  const columnScopeTitle = ss.getRangeByName("ColumnScopeTitle").getValue();
  const columnIdentificatorTitle = ss.getRangeByName("ColumnIdentificatorTitle").getValue();
  const columnExperimentEventNameTitle = ss.getRangeByName("ColumnExperimentEventNameTitle").getValue();
  const columnExperimentVariantParameterTitle = ss.getRangeByName("ColumnExperimentVariantParameterTitle").getValue();
  const queryInformationLogging = ss.getRangeByName("SettingsQueryInformationCheckbox").getValue();
  const queryPricePerTiB = ss.getRangeByName("SettingsQueryPricePerTiB").getValue();

  function colLetter(n) {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  const varParamColLetter = colLetter(typeof experimentVariantParameterColumn === 'number' ? experimentVariantParameterColumn : 0);

const results = { valid: [], skipped: [] };
  const lastRow = sheet.getLastRow();

  function pushStatusOnly(topRow, idVal) {
    const idStr = normalizeExperimentId(idVal);
    if (!idStr) return false;
    // A-status row
    results.valid.push({
      id: idStr,
      variant: "A",
      // only fields used by MERGE for STATUS_ONLY must be present:
      analyze_test: false,
      export_mode: "STATUS_ONLY"
    });
    // B-status row
    results.valid.push({
      id: idStr,
      variant: "B",
      analyze_test: false,
      export_mode: "STATUS_ONLY"
    });
    return true;
  }

  for (let r = firstRow; r <= lastRow; r += 2) {
    const r2 = r + 1; if (r2 > lastRow) break;

    const analyzeRaw = String(sheet.getRange(r, analyzeTestColumn).getValue() || '').trim();
    let export_mode = null;
    if (analyzeRaw === "Yes")      export_mode = "ANALYZE";
    else if (analyzeRaw === "Update") export_mode = "UPDATE";
    else export_mode = "STATUS_ONLY";

    // If STATUS_ONLY, just export ID+variant with analyze_test=false and skip all validations.
    if (export_mode === "STATUS_ONLY") {
      const idVal = sheet.getRange(r, idColumn).getValue();
      if (!pushStatusOnly(r, idVal)) {
        results.skipped.push(`Rows ${r}-${r2} skipped (STATUS_ONLY): missing Experiment ID.`);
      }
      continue; // move to next block
    }

    // MERGED (top row)
    const valIdColumnRaw = sheet.getRange(r, idColumn).getValue();
    const valIdColumn = normalizeExperimentId(valIdColumnRaw);
    const valExperimentNameColumn = sheet.getRange(r, experimentNameColumn).getValue();
    const valConversionEventCountColumn = sheet.getRange(r, conversionEventCountColumn).getValue();
    const valAnalyzeTestColumnStr = analyzeRaw;
    const valEventValueTestColumnStr = sheet.getRange(r, eventValueTestColumn).getValue();
    const valHypothesisColumn = sheet.getRange(r, hypothesisColumn).getValue();
    const valConfidenceColumn = sheet.getRange(r, confidenceColumn).getValue();
    const valDescriptionColumn = sheet.getRange(r, descriptionColumn).getValue();
    const valScopeColumn = sheet.getRange(r, scopeColumn).getValue();
    const valIdentitySourceColumn = sheet.getRange(r, identitySourceColumn).getValue();
    const valAnalyticsTool = String(getAnalyticsTool()).toUpperCase();
    const valQueryInformationLogging = queryInformationLogging;
    const valQueryPricePerTiB= queryPricePerTiB;

    const valVariantSettings = String(sheet.getRange(r, variantSettingsColumn).getValue() || "Same");
    const isDifferent = (valVariantSettings === "Different");

    const valExperimentEventValueParameterColumn = sheet.getRange(r, experimentEventValueParameterColumn).getValue();
    const valUserOverlapColum = sheet.getRange(r, userOverlapColumn).getValue();

    // UNMERGED (both rows)
    const valVariantNameColumn_r = sheet.getRange(r, variantNameColumn).getValue();
    const valVariantNameColumn_r2 = sheet.getRange(r2, variantNameColumn).getValue();
    const valExperimentVariantStringColumn_r = sheet.getRange(r, experimentVariantStringColumn).getValue();
    const valExperimentVariantStringColumn_r2 = sheet.getRange(r2, experimentVariantStringColumn).getValue();

    const valExperimentEventNameColumn_r = sheet.getRange(r, experimentEventNameColumn).getValue();
    const valExperimentVariantParameterColumn_r = sheet.getRange(r, experimentVariantParameterColumn).getValue();
    const valExperimentEventNameColumn_r2 = sheet.getRange(r2, experimentEventNameColumn).getValue();
    const valExperimentVariantParameterColumn_r2 = sheet.getRange(r2, experimentVariantParameterColumn).getValue();

    const topConversionEvent = sheet.getRange(r, conversionEventColumn).getValue();
    const botConversionEvent = sheet.getRange(r2, conversionEventColumn).getValue();

    // Date comparison
    const isCompared = !!sheet.getRange(r, dateComparisonColumn).getValue();
    const dateStart_r = formatDateForBQ(sheet.getRange(r,  dateStartColumn).getValue());
    const dateEnd_r = formatDateForBQ(sheet.getRange(r,  dateEndColumn).getValue());
    const dateStart_r2 = formatDateForBQ(sheet.getRange(r2, dateStartColumn).getValue());
    const dateEnd_r2 = formatDateForBQ(sheet.getRange(r2, dateEndColumn).getValue());

    // VALIDATIONS
    const missingCols = [];
    if (!valIdColumn) missingCols.push(columnIdTitle);
    if (!valExperimentNameColumn) missingCols.push(columnExperimentNameTitle);
    if (String(valAnalyzeTestColumnStr).trim() === "") missingCols.push(columnAnalyzeTitle);
    if (String(valEventValueTestColumnStr).trim() === "") missingCols.push(columnEventValueTestTitle);
    if (!valHypothesisColumn) missingCols.push(columnHypothesisTitle);
    if (!valConfidenceColumn) missingCols.push(columnConfidenceTitle);
    if (!valDescriptionColumn) missingCols.push(columnDescriptionTitle);
    if (!valScopeColumn) missingCols.push(columnScopeTitle);
    if (!valIdentitySourceColumn) missingCols.push(columnIdentificatorTitle);

    if (isCompared) {
      if (!dateStart_r) missingCols.push(columnDateStartTitle + ": Top row");
      if (!dateEnd_r) missingCols.push(columnDateEndTitle + ": Top row");
      if (!dateStart_r2) missingCols.push(columnDateStartTitle + ": Bottom row");
      if (!dateEnd_r2) missingCols.push(columnDateEndTitle + ": Bottom row");
    } else {
      if (!dateStart_r) missingCols.push(columnDateStartTitle);
      if (!dateEnd_r) missingCols.push(columnDateEndTitle);
    }

    if (!valVariantNameColumn_r || !valVariantNameColumn_r2) {
      missingCols.push(columnVariantNameTitle + ": Must be filled in row " + r + " and " + r2);
    }
    if (!valExperimentVariantStringColumn_r || !valExperimentVariantStringColumn_r2) {
      missingCols.push(columnExperimentVariantStringTitle + ": Must be filled in row " + r + " and " + r2);
    }
    if (!valExperimentEventNameColumn_r) {
      missingCols.push(varParamColLetter + columnExperimentEventNameTitle + ": Top row must be filled");
    }
    if (isDifferent && !valExperimentEventNameColumn_r2) {
      missingCols.push(varParamColLetter + columnExperimentEventNameTitle + ": Bottom row must be filled for 'Different'");
    }
    if (!valExperimentVariantParameterColumn_r) {
      missingCols.push(varParamColLetter + columnExperimentVariantParameterTitle + ": Top row must be filled");
    }
    if (isDifferent && !valExperimentVariantParameterColumn_r2) {
      missingCols.push(varParamColLetter + columnExperimentVariantParameterTitle + ": Bottom row must be filled for 'Different'");
    }

    if (!topConversionEvent) {
      missingCols.push(columnConversionEventTitle + ": Top row");
    }
    if (isDifferent && !botConversionEvent) {
      missingCols.push(columnConversionEventTitle + ": Bottom row for 'Different'");
    }

    if (missingCols.length > 0) {
      results.skipped.push("Block at rows " + r + "-" + r2 + " skipped. Missing: " + missingCols.join(", "));
      continue;
    }

    // NORMALIZATIONS
    const boolAnalyzeTestColumn = (String(analyzeRaw).toLowerCase() === "yes");
    const boolEventValueTestColumn = (String(valEventValueTestColumnStr).toLowerCase() === "yes");

    const rawConfidence = valConfidenceColumn;
    const newConfidence = (typeof rawConfidence === 'number')
      ? Math.round(rawConfidence * 100)
      : Number(String(rawConfidence).replace(/%/g, ""));

    const conversion_event_A = String(topConversionEvent);
    const conversion_event_B = String(isDifferent ? botConversionEvent : topConversionEvent);

    const exp_event_name_A = String(valExperimentEventNameColumn_r || '');
    const exp_event_name_B = String(isDifferent ? (valExperimentEventNameColumn_r2 || '') : (valExperimentEventNameColumn_r || ''));
    const exp_variant_param_A = String(valExperimentVariantParameterColumn_r || '');
    const exp_variant_param_B = String(isDifferent ? (valExperimentVariantParameterColumn_r2 || '') : (valExperimentVariantParameterColumn_r || ''));

    // RECORDS
    const rec1 = {
      id: String(valIdColumn),
      variant: "A",
      date_start: dateStart_r,
      date_end: dateEnd_r,
      date_comparison: isCompared,
      experiment_name: String(valExperimentNameColumn),
      variant_name: String(valVariantNameColumn_r),
      conversion_event: conversion_event_A,
      conversion_count_all: valConversionEventCountColumn,
      exp_variant_string: String(valExperimentVariantStringColumn_r),
      analyze_test: boolAnalyzeTestColumn,
      event_value_test: boolEventValueTestColumn,
      hypothesis: String(valHypothesisColumn),
      confidence: newConfidence,
      description: String(valDescriptionColumn),
      scope: String(valScopeColumn),
      identity_source: String(valIdentitySourceColumn),
      experiment_event_name: exp_event_name_A,
      experiment_variant_parameter: exp_variant_param_A,
      experiment_event_value_parameter: String(valExperimentEventValueParameterColumn),
      user_overlap: String(valUserOverlapColum),
      export_mode,
      analytics_tool: valAnalyticsTool,
      query_information_logging: valQueryInformationLogging,
      query_price_per_tib: valQueryPricePerTiB
    };
    results.valid.push(rec1);

    const rec2 = {
      id: String(valIdColumn),
      variant: "B",
      date_start: isCompared ? dateStart_r2 : dateStart_r,
      date_end: isCompared ? dateEnd_r2   : dateEnd_r,
      date_comparison: isCompared,
      experiment_name: String(valExperimentNameColumn),
      variant_name: String(valVariantNameColumn_r2),
      conversion_event: conversion_event_B,
      conversion_count_all: valConversionEventCountColumn,
      exp_variant_string: String(valExperimentVariantStringColumn_r2),
      analyze_test: boolAnalyzeTestColumn,
      event_value_test: boolEventValueTestColumn,
      hypothesis: String(valHypothesisColumn),
      confidence: newConfidence,
      description: String(valDescriptionColumn),
      scope: String(valScopeColumn),
      identity_source: String(valIdentitySourceColumn),
      experiment_event_name: exp_event_name_B,
      experiment_variant_parameter: exp_variant_param_B,
      experiment_event_value_parameter: String(valExperimentEventValueParameterColumn),
      user_overlap: String(valUserOverlapColum),
      export_mode,
      analytics_tool: valAnalyticsTool,
      query_information_logging: valQueryInformationLogging,
      query_price_per_tib: valQueryPricePerTiB
    };
    results.valid.push(rec2);
  }
  return results;
}

/*********************************************************
 * EXPORT FILTERS (simple + advanced) VIA CSV LOAD
 *********************************************************/
function exportExperimentFiltersToBigQueryCSVLoad() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var expSheet = ss.getSheetByName(experimentSheetName);
  var filterSheet = ss.getSheetByName(filtersSheetName);

  // 1) Read BigQuery settings from named ranges
  var projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  var datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  var datasetLoc = ss.getRangeByName("SettingsBigQueryDataSetLocation").getValue();
  var filtersTable = ss.getRangeByName("SettingsBigQueryExperimentFiltersTable").getValue();

  // 2) Ensure the dataset exists (create if missing)
  ensureDatasetWithLocation(projectId, datasetId, datasetLoc);

  // ✅ Collect all Analyze=Yes experiment IDs (even if no filters)
  var idsToSync = collectAnalyzeYesExperimentIds(expSheet);
  if (!idsToSync.length) {
    return "Filters sync skipped (no experiments marked Yes).";
  }

  // Build staging rows (actual filter rows)
  var flat = flattenExperimentFilters(expSheet, filterSheet); // may be empty if filters removed
  var rows = flat.valid;
  if (flat.skipped.length) SpreadsheetApp.getUi().alert("Some Filters were skipped:\n\n" + flat.skipped.join("\n"));

  // --- Stage 1: load ids stage (always) ---
  var idsStage = filtersTable + "_ids_stage";
  var idsCsv = idsToSync.map(function(id) { return toCsvCell(id); }).join("\n");
  var idsBlob = Utilities.newBlob(idsCsv, "application/octet-stream", "filters_ids_stage.csv");

  var idsLoadJob = {
    configuration: { load: {
      destinationTable: { projectId: projectId, datasetId: datasetId, tableId: idsStage },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      schema: { fields: [{ name: "id", type: "STRING" }] }
    }}
  };

  var idsLoadRes = BigQuery.Jobs.insert(idsLoadJob, projectId, idsBlob);
  waitForJobDone(projectId, idsLoadRes.jobReference.jobId, 'load experiments_filters_ids_stage');
  setTableTimeToLive(projectId, datasetId, idsStage, timeToLiveDays);

  var t = "`" + projectId + "." + datasetId + "." + filtersTable + "`";
  var sIds = "`" + projectId + "." + datasetId + "." + idsStage + "`";

  // ✅ Always delete filters for all Analyze=Yes experiments
  runQuery(projectId,
    "DELETE FROM " + t + " WHERE id IN (SELECT DISTINCT id FROM " + sIds + ")",
    "DELETE filters for Analyze=Yes ids"
  );

  // --- Stage 2: if there are filters, load filters_stage and insert ---
  if (!rows.length) {
    return "Filters sync complete (cleared filters for " + idsToSync.length + " experiments; inserted 0 rows).";
  }

  var cols = ["id","variant","enabled","filter_type","filter_on_value","filter_scope","filter_field","filter_value","notes","source"];
  var csv = rows.map(function(r) { return cols.map(function(c) { return toCsvCell(r[c]); }).join(","); }).join("\n");
  var blob = Utilities.newBlob(csv, "application/octet-stream", "filters_stage.csv");
  var stage = filtersTable + "_stage";

  var loadJob = {
    configuration: { load: {
      destinationTable: { projectId: projectId, datasetId: datasetId, tableId: stage },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      schema: { fields: [
        { name: "id", type: "STRING" },
        { name: "variant", type: "STRING" },
        { name: "enabled", type: "BOOL" },
        { name: "filter_type", type: "STRING" },
        { name: "filter_on_value", type: "STRING" },
        { name: "filter_scope", type: "STRING" },
        { name: "filter_field", type: "STRING" },
        { name: "filter_value", type: "STRING" },
        { name: "notes", type: "STRING" },
        { name: "source", type: "STRING" }
      ]}
    }}
  };

  var loadRes = BigQuery.Jobs.insert(loadJob, projectId, blob);
  waitForJobDone(projectId, loadRes.jobReference.jobId, 'load experiments_filters_stage');
  setTableTimeToLive(projectId, datasetId, stage, timeToLiveDays);

  var s = "`" + projectId + "." + datasetId + "." + stage + "`";

  runQuery(projectId,
    "INSERT INTO " + t + " (id,variant,enabled,filter_type,filter_on_value,filter_scope,filter_field,filter_value,notes,source) " +
    "SELECT id,variant,enabled,filter_type,filter_on_value,filter_scope,filter_field,filter_value,notes,source FROM " + s,
    "INSERT filters"
  );

  return "Filters sync complete (cleared filters for " + idsToSync.length + " experiments; inserted " + rows.length + " rows).";
}

/** Merge simple+advanced. Only for experiments with Analyze=Yes. */
function flattenExperimentFilters(expSheet, filterSheet) {
  const results = { valid: [], skipped: [] };

  // Build index of enabled advanced rows by Experiment_ID and variant
  const advIndex = {};
  if (filterSheet) {
    const lastData = (typeof filtersGetLastDataRow === 'function') ? filtersGetLastDataRow(filterSheet) : filterSheet.getLastRow();
    if (lastData >= filtersDataStartRow) {
      const numRows = lastData - filtersDataStartRow + 1;
      const vals = filterSheet.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();
      for (let i = 0; i < vals.length; i++) {
        const expId = normalizeExperimentId(vals[i][0]);
        const variant = String(vals[i][1] || '').trim().toUpperCase();
        const enabled = !!vals[i][2];
        const ftype = String(vals[i][3] || '').trim();
        const onLbl = filtersNormOnToLong(vals[i][4] || 'Both');
        const scope = String(vals[i][5] || '').trim();
        const field = String(vals[i][6] || '').trim();
        const value = String(vals[i][7] || '').trim();
        const notes = String(vals[i][8] || '').trim();
        if (!expId || (variant !== 'A' && variant !== 'B') || !enabled) continue;
        if (!advIndex[expId]) advIndex[expId] = { A: [], B: [] };
        advIndex[expId][variant].push({
          id: expId, variant, enabled: true,
          filter_type: ftype || 'Include',
          filter_on_value: onLbl,
          filter_scope: scope || 'Event',
          filter_field: field, filter_value: value,
          notes, source: 'advanced'
        });
      }
    }
  }

  // Walk Experiments blocks
  const lastRow = expSheet.getLastRow();
  for (let r = firstRow; r <= lastRow; r += 2) {
    const r2 = r + 1; if (r2 > lastRow) break;

    const analyzeVal = String(expSheet.getRange(r, analyzeTestColumn).getValue() || '').trim();
    if (analyzeVal !== 'Yes') continue; // Filters only for Yes

    const idStr = normalizeExperimentId(expSheet.getRange(r, idColumn).getValue());
    const nameStr = String(expSheet.getRange(r, experimentNameColumn).getValue() || '').trim();
    if (!idStr && !nameStr) { results.skipped.push(`Rows ${r}-${r2}: missing Experiment ID/Name.`); continue; }
    const key = idStr || nameStr;

    const filterYes = String(expSheet.getRange(r, filterColumn).getValue() || '').toLowerCase() === 'yes';
    const advOn = !!expSheet.getRange(r, filterAdvancedColumn).getValue();
    const setting = String(expSheet.getRange(r, variantSettingsColumn).getValue() || 'Same');
    const different = (setting === 'Different');

    if (!filterYes) continue;

    if (advOn) {
      // Advanced: emit enabled rows for this experiment id (by id or name)
      const pushAll = (bag) => { (bag?.A || []).forEach(x => results.valid.push(x)); (bag?.B || []).forEach(x => results.valid.push(x)); };
      pushAll(advIndex[idStr]);
      pushAll(advIndex[nameStr]);
      continue;
    }

    // Simple: one row per variant if meaningful (field OR value present)
    const ftypeA = String(expSheet.getRange(r, filterTypeColumn).getValue() || 'Include');
    const onA = filtersNormOnToLong(expSheet.getRange(r, filterOnValueColumn).getValue() || 'Both');
    const scopeA = String(expSheet.getRange(r, filterScopeColumn).getValue() || 'Event');
    const fieldA = String(expSheet.getRange(r, filterFieldColumn).getValue() || '').trim();
    const valueA = String(expSheet.getRange(r, filterValueColumn).getValue() || '').trim();

    let ftypeB = ftypeA, onB = onA, scopeB = scopeA, fieldB = fieldA, valueB = valueA;
    if (different) {
      ftypeB = String(expSheet.getRange(r2, filterTypeColumn).getValue() || ftypeA);
      onB = filtersNormOnToLong(expSheet.getRange(r2, filterOnValueColumn).getValue() || onA);
      scopeB = String(expSheet.getRange(r2, filterScopeColumn).getValue() || scopeA);
      const fB = String(expSheet.getRange(r2, filterFieldColumn).getValue() || '').trim();
      const vB = String(expSheet.getRange(r2, filterValueColumn).getValue() || '').trim();
      if (fB) fieldB = fB; if (vB) valueB = vB;
    }

    if (fieldA || valueA) results.valid.push({
      id: key, variant: 'A', enabled: true, filter_type: ftypeA, filter_on_value: onA,
      filter_scope: scopeA, filter_field: fieldA, filter_value: valueA,
      notes: 'from Experiments (simple)', source: 'simple'
    });
    if (fieldB || valueB) results.valid.push({
      id: key, variant: 'B', enabled: true, filter_type: ftypeB, filter_on_value: onB,
      filter_scope: scopeB, filter_field: fieldB, filter_value: valueB,
      notes: 'from Experiments (simple)', source: 'simple'
    });
  }

  return results;
}

/*********************************************************
 * NORMALIZE "Filter On Value" to long labels (safety)
 *********************************************************/
function filtersNormOnToLong(s) {
  s = String(s || '').trim().toLowerCase();
  if (!s) return 'Both';
  if (s.indexOf('experiment') > -1) return 'Experiment Event';
  if (s.indexOf('conversion') > -1) return 'Conversion Event';
  return 'Both';
}

/*********************************************************
 * HELPER: FORMAT DATE => YYYY-MM-DD
 *********************************************************/
function formatDateForBQ(dateValue) {
  if (!dateValue || Object.prototype.toString.call(dateValue) !== '[object Date]' || isNaN(dateValue)) {
    return "";
  }
  const y = dateValue.getFullYear();
  const m = ("0" + (dateValue.getMonth() + 1)).slice(-2);
  const d = ("0" + dateValue.getDate()).slice(-2);
  return y + "-" + m + "-" + d;
}

/** Normalize Experiment ID for export (01, 02, ...). Keeps non-numeric IDs unchanged. */
function normalizeExperimentId(idVal) {
  const s = String(idVal ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return Utilities.formatString("%02d", parseInt(s, 10)); // min 2 digits
  return s;
}

/*********************************************************
 * MAIN EXPORT FUNCTION: LOAD IMAGES VIA CSV LOAD (WRITE_TRUNCATE)
 *********************************************************/
function exportExperimentImagesToBigQueryCSVLoad() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);

  // 1) Read BigQuery settings from named ranges
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const datasetLoc = ss.getRangeByName("SettingsBigQueryDataSetLocation").getValue();
  const imagesTable = ss.getRangeByName("SettingsBigQueryExperimentImagesTable").getValue();

  // 2) Ensure the dataset exists (create if missing)
  ensureDatasetWithLocation(projectId, datasetId, datasetLoc);

  const flat = flattenExperimentImages(sheet); // now gates Yes/Update
  const rows = flat.valid;
  if (flat.skipped.length) SpreadsheetApp.getUi().alert("Some image rows were skipped:\n\n" + flat.skipped.join("\n"));
  if (!rows.length) return "No image rows to export.";

  const cols = ["id","variant","image_url"];
  const csv = rows.map(r => cols.map(c => toCsvCell(r[c])).join(",")).join("\n");
  const blob = Utilities.newBlob(csv, "application/octet-stream", "images_stage.csv");
  const stage = imagesTable + "_stage";

  const loadJob = {
    configuration: { load: {
      destinationTable: { projectId, datasetId, tableId: stage },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      schema: { fields: [
        { name: "id", type: "STRING" },
        { name: "variant", type: "STRING" },
        { name: "image_url", type: "STRING" }
      ]}
    }}
  };
  const loadRes = BigQuery.Jobs.insert(loadJob, projectId, blob);
  waitForJobDone(projectId, loadRes.jobReference.jobId, 'load experiments_images_stage');
  setTableTimeToLive(projectId, datasetId, stage, timeToLiveDays);

  const t = `\`${projectId}.${datasetId}.${imagesTable}\``;
  const s = `\`${projectId}.${datasetId}.${stage}\``;
  runQuery(projectId, `DELETE FROM ${t} WHERE id IN (SELECT DISTINCT id FROM ${s})`);
  runQuery(projectId, `INSERT INTO ${t} (id,variant,image_url) SELECT id,variant,image_url FROM ${s}`);

  return "Images upsert complete (" + rows.length + " staging rows).";
}

function flattenExperimentImages(sheet) {
  const results = { valid: [], skipped: [] };
  const lastRow = sheet.getLastRow();
  for (let r = firstRow; r <= lastRow; r += 2) {
    const r2 = r + 1; if (r2 > lastRow) break;

    const analyzeVal = String(sheet.getRange(r, analyzeTestColumn).getValue() || '').trim();
    if (["Yes","Update"].indexOf(analyzeVal) === -1) continue;

    const idVal = sheet.getRange(r, idColumn).getValue();
    if (!idVal) { results.skipped.push(`Rows ${r}-${r2}: missing ID`); continue; }
    const idStr = normalizeExperimentId(idVal);

    const imgsA = splitByNewlines(String(sheet.getRange(r, imagesColumn).getValue() || ""));
    const imgsB = splitByNewlines(String(sheet.getRange(r2, imagesColumn).getValue() || ""));
    imgsA.forEach(u => { if (u) results.valid.push({ id: idStr, variant: "A", image_url: fixDriveUrl(u) }); });
    imgsB.forEach(u => { if (u) results.valid.push({ id: idStr, variant: "B", image_url: fixDriveUrl(u) }); });
  }
  return results;
}

/*********************************************************
 * HELPER: REWRITE GOOGLE DRIVE URL TO DIRECT LINK FORMAT
 * Example: 
 *   "https://drive.google.com/file/d/ABC123/view?usp=sharing" 
 * becomes 
 *   "https://drive.google.com/uc?id=ABC123"
 *********************************************************/
function fixDriveUrl(url) {
  const prefix = "https://drive.google.com/file/d/";
  if (url.startsWith(prefix)) {
    const startPos = url.indexOf("/d/") + 3;
    const endPos = url.indexOf("/view", startPos);
    if (endPos > startPos) {
      const fileId = url.substring(startPos, endPos);
      return "https://drive.google.com/uc?id=" + fileId;
    }
  }
  return url;
}

/*********************************************************
 * MAIN EXPORT FUNCTION: EXPORT EXPERIMENT LINKS
 *********************************************************/
function exportExperimentLinksToBigQueryCSVLoad() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);

  // 1) Read BigQuery settings from named ranges
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const datasetLoc = ss.getRangeByName("SettingsBigQueryDataSetLocation").getValue();
  const linksTable = ss.getRangeByName("SettingsBigQueryExperimentLinksTable").getValue();

  // 2) Ensure the dataset exists (create if missing)
  ensureDatasetWithLocation(projectId, datasetId, datasetLoc);

  const flat = flattenExperimentLinks(sheet); // now gates Yes/Update
  const rows = flat.valid;
  if (flat.skipped.length) SpreadsheetApp.getUi().alert("Some link rows were skipped:\n\n" + flat.skipped.join("\n"));
  if (!rows.length) return "No link rows to export.";

  const cols = ["id","link"];
  const csv = rows.map(r => cols.map(c => toCsvCell(r[c])).join(",")).join("\n");
  const blob = Utilities.newBlob(csv, "application/octet-stream", "links_stage.csv");
  const stage = linksTable + "_stage";

  // Load staging
  const loadJob = {
    configuration: { load: {
      destinationTable: { projectId, datasetId, tableId: stage },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      schema: { fields: [
        { name: "id", type: "STRING" },
        { name: "link", type: "STRING" }
      ]}
    }}
  };
  
  const loadRes = BigQuery.Jobs.insert(loadJob, projectId, blob);
  waitForJobDone(projectId, loadRes.jobReference.jobId, 'load experiments_links_stage');
  setTableTimeToLive(projectId, datasetId, stage, timeToLiveDays);

  // Replace per id
  const t = `\`${projectId}.${datasetId}.${linksTable}\``;
  const s = `\`${projectId}.${datasetId}.${stage}\``;
  runQuery(projectId, `DELETE FROM ${t} WHERE id IN (SELECT DISTINCT id FROM ${s})`);
  runQuery(projectId, `INSERT INTO ${t} (id,link) SELECT id,link FROM ${s}`);

  return "Links upsert complete (" + rows.length + " staging rows).";
}

function flattenExperimentLinks(sheet) {
  const results = { valid: [], skipped: [] };
  const lastRow = sheet.getLastRow();
  for (let r = firstRow; r <= lastRow; r += 2) {
    const r2 = r + 1; if (r2 > lastRow) break;

    const analyzeVal = String(sheet.getRange(r, analyzeTestColumn).getValue() || '').trim();
    if (["Yes","Update"].indexOf(analyzeVal) === -1) continue;

    const idVal = sheet.getRange(r, idColumn).getValue();
    if (!idVal) { results.skipped.push(`Rows ${r}-${r2}: missing ID`); continue; }
    const idStr = normalizeExperimentId(idVal);

    const linksCell = sheet.getRange(r, linksColumn).getValue();
    if (!linksCell) continue;

    splitByNewlines(linksCell).forEach(link => {
      results.valid.push({ id: idStr, link: link });
    });
  }
  return results;
}

/*********************************************************
 * HELPER: SPLIT TEXT BY NEWLINE, IGNORING BLANKS
 *********************************************************/
function splitByNewlines(cellValue) {
  const normalized = String(cellValue || "").replace(/\r\n/g, "\n");
  const parts = normalized.split("\n").map(x => x.trim());
  return parts.filter(x => x !== "");
}

/*********************************************************
 * HELPER: ENSURE DATASET EXISTS IN SPECIFIED LOCATION
 *********************************************************/
function ensureDatasetWithLocation(projectId, datasetId, datasetLoc) {
  Logger.log("Ensuring dataset '%s' in location '%s'...", datasetId, datasetLoc);
  try {
    const ds = BigQuery.Datasets.get(projectId, datasetId);
    Logger.log("Dataset '%s' found. Location=%s", datasetId, ds.location);
  } catch (err) {
    Logger.log("Dataset '%s' not found. Creating in location '%s'...", datasetId, datasetLoc);
    const newDS = {
      datasetReference: {
        projectId: projectId,
        datasetId: datasetId
      },
      location: datasetLoc
    };
    BigQuery.Datasets.insert(newDS, projectId);
    Logger.log("Created dataset '%s' in location '%s'.", datasetId, datasetLoc);
  }
}

/*********************************************************
 * HELPER: ESCAPE CSV CELLS (ADD QUOTES IF NECESSARY)
 *********************************************************/
function toCsvCell(value) {
  if (value == null) return "";
  // Convert to string and remove any newline characters
  let s = String(value).replace(/[\r\n]+/g, " ");
  // If the cell value contains commas, quotes, or newlines, wrap it and escape quotes.
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/*********************************************************
 * HELPER: WAIT FOR STAGING TABLES BEING FINISHED
 *********************************************************/
function waitForJobDone(projectId, jobId, label) {
  const maxMs = 5 * 60 * 1000;      // 5 minutes cap
  const start = Date.now();
  let tries = 0;
  while (true) {
    const j = BigQuery.Jobs.get(projectId, jobId);
    const st = (j.status && j.status.state) || 'UNKNOWN';
    if (st === 'DONE') {
      if (j.status.errorResult) {
        throw new Error((label || 'BQ job') + ' failed: ' + JSON.stringify(j.status.errors || j.status.errorResult));
      }
      Logger.log('BQ OK %s -> DONE after %sms (tries=%s)', label || '', Date.now() - start, tries);
      return j;
    }
    if (Date.now() - start > maxMs) {
      throw new Error((label || 'BQ job') + ' timed out after ' + (Date.now() - start) + 'ms');
    }
    Utilities.sleep(Math.min(1000 + tries * 250, 5000)); // gentle backoff
    tries++;
  }
}

/** Collect normalized experiment IDs for Analyze=Yes blocks (top row of each 2-row block). */
function collectAnalyzeYesExperimentIds(expSheet) {
  var ids = [];
  var seen = {};
  var lastRow = expSheet.getLastRow();

  for (var r = firstRow; r <= lastRow; r += 2) {
    var r2 = r + 1;
    if (r2 > lastRow) break;

    var analyzeVal = String(expSheet.getRange(r, analyzeTestColumn).getValue() || '').trim();
    if (analyzeVal !== 'Yes') continue;

    var idVal = expSheet.getRange(r, idColumn).getValue();
    var idStr = normalizeExperimentId(idVal);
    if (!idStr) continue;

    if (!seen[idStr]) {
      seen[idStr] = true;
      ids.push(idStr);
    }
  }
  return ids;
}

/*********************************************************
 * HELPER: QUERY RUNNER
 *********************************************************/
function runQuery(projectId, query, label) {
  const job = BigQuery.Jobs.insert({ configuration: { query: { query, useLegacySql: false } } }, projectId);
  const done = waitForJobDone(projectId, job.jobReference.jobId, label || 'query');
  return done;
}

/*********************************************************
 * HELPER: TIME TO LIVE FOR STAGING TABLES
 *********************************************************/
function setTableTimeToLive(projectId, datasetId, tableId, days) {
  // Sets absolute expiration 'days' from now (in ms since epoch as a string)
  const tbl = BigQuery.Tables.get(projectId, datasetId, tableId);
  tbl.expirationTime = String(Date.now() + days * 24 * 60 * 60 * 1000);
  BigQuery.Tables.update(tbl, projectId, datasetId, tableId);
}

/** Summarize export modes at the experiment level (dedup by id). */
function summarizeExperimentExport(rows) {
  const idsAnalyze = new Set();
  const idsUpdate = new Set();
  const idsNo = new Set();

  rows.forEach(r => {
    const id = String(r.id || '').trim();
    if (!id) return;
    if (r.export_mode === 'ANALYZE') idsAnalyze.add(id);
    else if (r.export_mode === 'UPDATE') idsUpdate.add(id);
    else if (r.export_mode === 'STATUS_ONLY') idsNo.add(id);
  });

  return {
    analyzed: idsAnalyze.size,
    updated: idsUpdate.size,
    no: idsNo.size
  };
}

/** Nicely pluralize. */
function pluralize(n) { return n === 1 ? '' : 's'; }

/**
 * Deletes experiments from the sheet and from BigQuery.
 * It checks for checkboxes in Column W (merged, top row of each 2-row block).
 * For each block flagged for deletion, it gets the key from merged Column A,
 * deletes the block from the sheet, and collects the id.
 * Then it deletes rows with those ids from the three BigQuery tables.
 */
function deleteExperiments() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert("Are you sure you want to delete the Experiment?", ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  if (sheet.getName() !== experimentSheetName) {
    ui.alert('Please run this from the '+experimentSheetName+' sheet.');
    return;
  }

  let lastRow = sheet.getLastRow();
  const expKeys = new Set(); // holds string keys: numeric ID and/or name
  let deletedBlocks = 0;

  // bottom-up over 2-row blocks
  for (let r = lastRow; r >= firstRow; r--) {
    if ((r - firstRow) % 2 !== 0) continue; // only top row of block
    const chk = sheet.getRange(r, editExperimentColumn);
    if (chk.getValue() === true) {
      // collect identifiers BEFORE deleting rows
      const idVal = sheet.getRange(r, idColumn).getValue(); // Column A (merged)
      const nameVal = sheet.getRange(r, experimentNameColumn).getValue(); // your Experiment name/ID column
      const idStr = String(idVal || '').trim();
      const nameStr = String(nameVal || '').trim();
      if (idStr) expKeys.add(idStr);
      if (nameStr) expKeys.add(nameStr);

      // delete the 2-row block
      sheet.deleteRows(r, 2);
      deletedBlocks++;
    }
  }

  // Delete matching Filters rows (by any of the collected keys)
  let removedFilters = 0;
  if (expKeys.size > 0 && typeof filtersDeleteRowsForExperiment === 'function') {
    removedFilters = filtersDeleteRowsForExperiment(Array.from(expKeys));
    // keep the named range tidy if helper exists
    if (typeof filtersUpdateFiltersTableNamedRange === 'function') {
      filtersUpdateFiltersTableNamedRange();
    }
    // optional: re-apply your block formatting if you use it
    if (typeof filtersBtnFormatBlocks === 'function') {
      filtersBtnFormatBlocks();
    }
  }

  // Delete from BigQuery (your existing function)
  if (deletedBlocks > 0 && typeof deleteRowsInBigQuery === 'function') {
    // Prefer numeric IDs for BQ; filter the keys to just numbers if that’s your convention
    const idsForBQ = Array.from(expKeys).filter(k => !isNaN(Number(k)));
    if (idsForBQ.length) deleteRowsInBigQuery(idsForBQ);
  }

  ui.alert(
    deletedBlocks > 0
      ? `Deleted ${deletedBlocks} experiment block${deletedBlocks !== 1 ? 's' : ''} from Experiments `
        + `and ${removedFilters} filter row${removedFilters !== 1 ? 's' : ''} from Filters.`
      : 'No experiments flagged for deletion.'
  );
}

// Delete all Filters rows whose Experiment_ID matches any of the provided identifiers (strings).
function filtersDeleteRowsForExperiment(expIdentifiers) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) return 0;

  const ids = (Array.isArray(expIdentifiers) ? expIdentifiers : [expIdentifiers])
    .map(v => String(v || '').trim())
    .filter(Boolean);
  if (!ids.length) return 0;

  const lastData = filtersGetLastDataRow(sh); // your safe detector
  if (lastData < filtersDataStartRow) return 0;

  const numRows = lastData - filtersDataStartRow + 1;
  const vals = sh.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();

  let deleted = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const rowExpId = String(vals[i][0] || '').trim(); // col 1 = Experiment_ID
    if (ids.indexOf(rowExpId) !== -1) {
      sh.deleteRow(filtersDataStartRow + i);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Deletes rows from three BigQuery tables where the 'id' is in the given list.
 */
function deleteRowsInBigQuery(ids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  
  // Get table names from named ranges:
  const expTable = ss.getRangeByName("SettingsBigQueryExperimentTable").getValue();
  const linksTable = ss.getRangeByName("SettingsBigQueryExperimentLinksTable").getValue();
  const imagesTable = ss.getRangeByName("SettingsBigQueryExperimentImagesTable").getValue();
  const filtersTable = ss.getRangeByName("SettingsBigQueryExperimentFiltersTable").getValue();
  const reportsTable = ss.getRangeByName("SettingsBigQueryReportingTable").getValue();
  const queryInformationTable = ss.getRangeByName("SettingsBigQueryQueryInformationTable").getValue();

  ids = (ids || []).map(normalizeExperimentId).filter(Boolean);
  
  // Build the list of ids as a comma-separated list.
  // Adjust quoting if your id type is numeric. Here we assume they are strings.
  const idList = ids.map(function(id) { 
    return "'" + id + "'"; 
  }).join(", ");
  
  // Build the DELETE query for each table.
  const queries = [
    { table: expTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + expTable + "` WHERE id IN (" + idList + ")" },
    { table: linksTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + linksTable + "` WHERE id IN (" + idList + ")" },
    { table: imagesTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + imagesTable + "` WHERE id IN (" + idList + ")" },
    { table: filtersTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + filtersTable + "` WHERE id IN (" + idList + ")" },
    { table: reportsTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + reportsTable + "` WHERE id IN (" + idList + ")" },
    { table: queryInformationTable, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + queryInformationTable + "` WHERE id IN (" + idList + ")" }
  ];
  
  queries.forEach(function(item) {
    Logger.log("Deleting from table %s with query: %s", item.table, item.query);
    const jobConfig = {
      configuration: {
        query: {
          query: item.query,
          useLegacySql: false
        }
      }
    };
    const job = BigQuery.Jobs.insert(jobConfig, projectId);
    const jobId = job.jobReference.jobId;
    // Optionally wait for job completion
    const finishedJob = BigQuery.Jobs.get(projectId, jobId);
    if (finishedJob.status && finishedJob.status.errorResult) {
      Logger.log("Error deleting rows in table %s: %s", item.table, JSON.stringify(finishedJob.status.errors));
    } else {
      Logger.log("Successfully deleted rows in table %s.", item.table);
    }
  });
}