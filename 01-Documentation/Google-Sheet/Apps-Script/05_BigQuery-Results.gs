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


/*********************************************************
 * DOWNLOAD ANALYZED DATA TO REPORT SHEET
 *********************************************************/

function downloadReportingData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Retrieve BigQuery settings from named ranges.
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const tableId   = ss.getRangeByName("SettingsBigQueryReportingTable").getValue();
  
  // Build the SQL query (using Standard SQL).
  const query = 
    "SELECT id, experiment_name, date_last_analyzed, date_start, date_end, hypothesis, confidence_level, analyze_test, user_overlap, conversion_event, conv_significance, conv_details, value_significance, value_details, scope, identity_source, test_a, conversion_a, test_b, conversion_b, conv_rate_a, conv_rate_b, conv_z_score, conv_p_value, mean_value_a, mean_value_b, t_value, value_p_value, total_conversion_value_a, total_conversion_value_b " +
    "FROM `" + projectId + "." + datasetId + "." + tableId + "` " +
    "ORDER BY analyze_test desc, date_last_analyzed DESC, CAST(id AS INT64) DESC, date_end DESC";
  
  const request = {
    query: query,
    useLegacySql: false
  };
  
  try {
    // Execute the query.
    const queryResults = BigQuery.Jobs.query(request, projectId);
    if (!queryResults.rows) {
      Logger.log("No rows returned.");
      return;
    }
    
    // Process returned rows into a 2D array.
    const data = queryResults.rows.map(function(row) {
      return row.f.map(function(field) {
        return field.v;
      });
    });
    
    // Get the "Results" sheet.
    const resultsSheet = ss.getSheetByName("Results");
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet("Results");
    }
    
    // Clear only rows firstRow and below.
    const totalRows = resultsSheet.getMaxRows();
    if (totalRows > 5) {
      resultsSheet.getRange(firstRow, 1, totalRows - 5, resultsSheet.getMaxColumns()).clear();
    }
    
    // Write the data starting at row firstRow.
    resultsSheet.getRange(firstRow, 1, data.length, data[0].length).setValues(data);
    resultsSheet.getRange(firstRow, 21, data.length, 2).setNumberFormat("0.00%");
    resultsSheet.getRange(firstRow, 23, data.length, 6).setNumberFormat("0.0000");
    resultsSheet.getRange(firstRow, 29, data.length, 2).setNumberFormat("#,##0.00");
    resultsSheet.getRange(firstRow, 1, firstRow-1, resultsSheet.getMaxColumns()).setWrap(true).setVerticalAlignment("top");
    
    // Apply formatting.
    formatResultsData(resultsSheet, firstRow);

    const msg = `All data has been downloaded.\nTotal Results: ${data.length}`;
    ss.toast(msg, "Download Complete", 5);
    
    Logger.log("Data downloaded and formatted successfully.");
    return data;
    ss.toast("Deletion complete.");
  } catch (err) {
    Logger.log("Error downloading data from BigQuery: " + err);
    SpreadsheetApp.getUi().alert("Failed to download data from BigQuery. Check logs for details.");
  }
}

/**
 * Formats the data in the Results sheet starting at startRow.
 * Even rows get a very light gray background.
 * In columns I (9) and J (10), if the text is "SIGNIFICANT", make it bold and green;
 * if "NOT SIGNIFICANT", make it normal and red.
 */
function formatResultsData(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  const totalCols = sheet.getMaxColumns();
  
  for (let r = startRow; r <= lastRow; r++) {
    // Set even rows to light gray, odd rows to white.
    if (r % 2 === 0) {
      sheet.getRange(r, 1, 1, totalCols).setBackground("#f1f1f1");
    } else {
      sheet.getRange(r, 1, 1, totalCols).setBackground("#ffffff");
    }
    
    // Format columns K (11) and M (13)
    const convSignificanceCell = sheet.getRange(r, 11);
    const valueSignificanceCell = sheet.getRange(r, 13);
    
    const convSignificanceText = String(convSignificanceCell.getValue()).toUpperCase();
    const valueSignificanceText = String(valueSignificanceCell.getValue()).toUpperCase();
    
    if (convSignificanceText === "SIGNIFICANT") {
      convSignificanceCell.setFontWeight("bold").setFontColor("green");
    } else if (convSignificanceText === "NOT_SIGNIFICANT") {
      convSignificanceCell.setFontWeight("normal").setFontColor("red");
    } else {
      convSignificanceCell.setFontWeight("normal").setFontColor("black");
    }
    
    if (valueSignificanceText === "SIGNIFICANT") {
      valueSignificanceCell.setFontWeight("bold").setFontColor("green");
    } else if (valueSignificanceText === "NOT_SIGNIFICANT") {
      valueSignificanceCell.setFontWeight("normal").setFontColor("red");
    } else {
      valueSignificanceCell.setFontWeight("normal").setFontColor("black");
    }
  }
}

/*********************************************************
 * DOWNLOAD COST DATA TO COST SHEET
 *********************************************************/
function downloadQueryInformationData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ... (Your settings variables remain the same) ...
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const tableId = ss.getRangeByName("SettingsBigQueryQueryInformationTable").getValue();

  const query = 
    "SELECT id, execution_time, job_ids, total_bytes_billed, total_bytes_billed, estimated_cost_usd " +
    "FROM `" + projectId + "." + datasetId + "." + tableId + "` " +
    "ORDER BY execution_time desc, id DESC";
  
  const request = {
    query: query,
    useLegacySql: false
  };
  
  try {
    const queryResults = BigQuery.Jobs.query(request, projectId);
    if (!queryResults.rows) {
      Logger.log("No rows returned.");
      return;
    }
    
    // Process returned rows into a 2D array.
    const data = queryResults.rows.map(function(row) {
      return row.f.map(function(field, index) {
        const value = field.v;

        // 1. Handle Timestamp (Index 1)
        if (index === 1 && value) {
          if (!isNaN(value)) return new Date(parseFloat(value) * 1000);
          return new Date(value);
        }

        // 2. Handle Bytes (Index 4) - CONVERT TO GB/MB
        if (index === 4 && value) {
          return formatBytes(value); 
        }

        return value;
      });
    });
    
    let resultsSheet = ss.getSheetByName(queryInfoSheetName);
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet(queryInfoSheetName);
    }
    
    const totalRows = resultsSheet.getMaxRows();
    if (totalRows > 5) {
      resultsSheet.getRange(firstRow, 1, totalRows - 5, resultsSheet.getMaxColumns()).clear();
    }
    
    // Write data
    resultsSheet.getRange(firstRow, 1, data.length, data[0].length).setValues(data);
    
    // --- UPDATED FORMATTING HERE ---
    resultsSheet.getRange(firstRow, 1, data.length, 2).setNumberFormat("00").setFontWeight("normal").setFontColor("black");
    resultsSheet.getRange(firstRow, 2, data.length, 1).setNumberFormat("yyyy-mm-dd hh:mm").setFontWeight("normal").setFontColor("black");
    
    resultsSheet.getRange(firstRow, 4, data.length, 1).setNumberFormat("#,##0").setFontWeight("normal").setFontColor("black");;
    resultsSheet.getRange(firstRow, 5, data.length, 1).setHorizontalAlignment("right").setFontWeight("normal").setFontColor("black");
    resultsSheet.getRange(firstRow, 6, data.length, 2).setNumberFormat("$#,##0.0000").setFontWeight("normal").setFontColor("black");
    resultsSheet.getRange(firstRow, 7, data.length, 1).insertCheckboxes().setHorizontalAlignment("center").setFontWeight("normal").setFontColor("black");
    resultsSheet.getRange(firstRow, 1, firstRow-1, resultsSheet.getMaxColumns()).setWrap(true).setVerticalAlignment("top").setFontWeight("normal").setFontColor("black");
    
    formatQueryInformationsData(resultsSheet, firstRow);

    const msg = `All data has been downloaded.\nTotal Results: ${data.length}`;
    ss.toast(msg, "Download Complete", 5);

    Logger.log("Data downloaded and formatted successfully.");
    return data;
  } catch (err) {
    Logger.log("Error downloading data from BigQuery: " + err);
    SpreadsheetApp.getUi().alert("Failed to download data: " + err);
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes == 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatQueryInformationsData(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  const totalCols = sheet.getMaxColumns();

  for (let r = startRow; r <= lastRow; r++) {
    if (r % 2 === 0) {
      sheet.getRange(r, 1, 1, totalCols).setBackground("#f1f1f1");
    } else {
      sheet.getRange(r, 1, 1, totalCols).setBackground("#ffffff");
    }
  }
}

/*********************************************************
 * DELETE COST DATA
 *********************************************************/
function deleteSelectedQueryInformation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(queryInfoSheetName);
  
  // Get all data, including headers
  const data = sheet.getDataRange().getValues();
  
  const idsToDelete = [];
  const rowsToDelete = [];
  
  // Loop through data starting from Row 6 (index 1) to skip headers
  // Column G (Checkboxes) is index 6. Column C (Job IDs) is index 2.
  for (let i = 5; i < data.length; i++) {
    if (data[i][6] === true) { // If checkbox is checked
      idsToDelete.push(data[i][2]); // Store the Job ID
      rowsToDelete.push(i + 1);     // Store the actual sheet row number (1-based)
    }
  }
  
  if (idsToDelete.length === 0) {
    SpreadsheetApp.getUi().alert("No rows selected for deletion.");
    return;
  }
  
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "Confirm Deletion", 
    "Are you sure you want to delete " + idsToDelete.length + " record(s) from BigQuery and this Sheet?", 
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    // 1. Delete from BigQuery
    try {
      deleteQueryInformationEstimatesInBigQuery(idsToDelete);
    } catch (e) {
      ui.alert("Error deleting from BigQuery: " + e.message);
      return; // Stop if BQ fails so we don't delete from sheet
    }
    
    // 2. Delete from Google Sheet
    // We must delete from bottom to top, otherwise row numbers shift up!
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    
    ss.toast("Deletion complete.");
  }
}

function deleteQueryInformationEstimatesInBigQuery(ids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectId = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetId = ss.getRangeByName("SettingsBigQueryExperimentsDataSetID").getValue();
  const tableId = ss.getRangeByName("SettingsBigQueryQueryInformationTable").getValue();
  
  // Format the array ['job1', 'job2'] into a SQL string: "'job1','job2'"
  // We map every ID to be wrapped in single quotes, then join them.
  const jobIdsList = ids.map(function(id) { return "'" + id + "'"; }).join(",");
  
  const queries = [
    { 
      table: tableId, 
      query: "DELETE FROM `" + projectId + "." + datasetId + "." + tableId + "` WHERE job_ids IN (" + jobIdsList + ")" 
    }
  ];
  
  queries.forEach(function(item) {
    Logger.log("Deleting from table %s...", item.table);
    
    const jobConfig = {
      configuration: {
        query: {
          query: item.query,
          useLegacySql: false
        }
      }
    };
    
    // Insert the job
    const job = BigQuery.Jobs.insert(jobConfig, projectId);
    const jobId = job.jobReference.jobId;
    
    // Wait for the job to complete (Poling)
    let finishedJob = BigQuery.Jobs.get(projectId, jobId);
    while (finishedJob.status.state !== 'DONE') {
      Utilities.sleep(1000); // Wait 1 second before checking again
      finishedJob = BigQuery.Jobs.get(projectId, jobId);
    }
    
    // Check for errors after completion
    if (finishedJob.status.errorResult) {
      Logger.log("Error deleting: " + JSON.stringify(finishedJob.status.errors));
      throw new Error(finishedJob.status.errorResult.message);
    } else {
      Logger.log("Successfully deleted rows in table %s.", item.table);
    }
  });
}

/*********************************************************
 * Pre-Test Calculator
 *********************************************************/

/**
 * Main function attached to the "Calculate" button in Google Sheets
 */
function runPreTestCalculator() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  // 1. Fetch BigQuery Config from Named Ranges
  const projectID = ss.getRangeByName("SettingsBigQueryProjectID").getValue();
  const datasetID = ss.getRangeByName("SettingsBigQueryDataSetID").getValue();
  const tableID = ss.getRangeByName("SettingsBigQueryTableID").getValue();
  const tool = ss.getRangeByName("SettingsAnalyticsTool").getValue();
  const queryPricePerTiB = ss.getRangeByName("SettingsQueryPricePerTiB").getValue(); // Fetches dynamic price
  const itemsObject = ss.getRangeByName("SettingsItemsObject").getValue(); // e.g., "items" or "Products"
  
  // --- FETCH USER INPUTS ---
  const lookbackWeeks = parseInt(sheet.getRange("C8").getValue()); 
  const days = lookbackWeeks * 7;
  
  const targetEvent = sheet.getRange("C9").getValue();       
  const targetParam = sheet.getRange("C10").getValue();       
  const targetParamValue = sheet.getRange("C11").getValue();  
  const conversionEvent = sheet.getRange("C12").getValue();  
  
  // --- VALIDATE REGEX ---
  if (targetParamValue && !ISVALIDREGEX(targetParamValue)) {
    SpreadsheetApp.getUi().alert(
      "Invalid Regular Expression", 
      "The Experiment Value you entered is not a valid regular expression. Please fix it and try again.", 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return; 
  }

  // --- DETERMINE PARAMETER TYPE ---
  let paramType = "Column"; 
  let sqlParamString = targetParam; 
  
  if (targetParam) {
    const lookupSheet = ss.getSheetByName("Lookup_Filter_Fields");
    if (lookupSheet) {
      const lastRow = lookupSheet.getLastRow();
      if (lastRow > 0) {
        const lookupData = lookupSheet.getRange(1, 1, lastRow, 2).getValues(); 
        for (let i = 0; i < lookupData.length; i++) {
          if (lookupData[i][1] === targetParam) { 
            paramType = lookupData[i][0]; 
            if (paramType === "Event") {
              sqlParamString = `event_params.${targetParam}`; 
            } else if (paramType === "Column") {
              sqlParamString = targetParam; 
            }
            break; 
          }
        }
      }
    }
  }

  // --- FETCH DYNAMIC FILTERS ---
  const filters = [];
  let filterRow = 27;
  
  while (sheet.getRange("B" + filterRow).getValue() !== "") {
    const filterType = sheet.getRange("B" + filterRow).getValue();   // Include / Exclude
    const filterTarget = sheet.getRange("C" + filterRow).getValue(); // Experiment / Conversion / Both
    const filterScope = sheet.getRange("D" + filterRow).getValue();  // Event / Column / User
    const filterField = sheet.getRange("E" + filterRow).getValue();  
    const filterValue = sheet.getRange("F" + filterRow).getValue();  
    
    // Only add if field and value are properly filled out
    if (filterField && filterValue) {
      if (!ISVALIDREGEX(filterValue)) {
        SpreadsheetApp.getUi().alert(
          "Invalid Filter RegEx", 
          `The regular expression in row ${filterRow} is invalid. Please fix it and try again.`, 
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return; // Stop the script
      }
      
      filters.push({
        type: filterType,
        target: filterTarget,
        scope: filterScope,
        field: filterField,
        value: filterValue
      });
    }
    filterRow++;
  }

  // --- BUILD QUERY ---
  const tablePath = `\`${projectID}.${datasetID}.${tableID}\``;
  let sql = "";

  if (tool === "GA4Dataform") {
    
    // 0. Handle the Base Experiment Parameter (Cells C8/C9) for Items
    let dataformParamCondition = "";
    if (targetParam && targetParamValue) {
      if (itemsObject && targetParam.startsWith(itemsObject + ".")) {
        const itemProp = targetParam.substring(itemsObject.length + 1);
        dataformParamCondition = `AND EXISTS (SELECT 1 FROM UNNEST(${itemsObject}) AS i WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${targetParamValue}'))`;
      } else {
        dataformParamCondition = `AND REGEXP_CONTAINS(CAST(${sqlParamString} AS STRING), r'${targetParamValue}')`;
      }
    }

    // 1. Build the dynamic filter strings
    let experimentFiltersSQL = "";
    let conversionFiltersSQL = "";

    filters.forEach(filter => {
      let conditionExp = "";
      let conditionConv = "";

      // Check if it's an Array/Item field
      if (itemsObject && filter.field.startsWith(itemsObject + ".")) {
        const itemProp = filter.field.substring(itemsObject.length + 1); 
        
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(${itemsObject}) AS i WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(e.${itemsObject}) AS i WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${filter.value}'))`;
        
      } else {
        // Standard Dataform fields
        let sqlField = filter.field;
        let convSqlField = `e.${filter.field}`;

        if (filter.scope === "Event") {
          sqlField = `event_params.${filter.field}`;
          convSqlField = `e.event_params.${filter.field}`;
        } else if (filter.scope === "User") {
          sqlField = `user_properties.${filter.field}`;
          convSqlField = `e.user_properties.${filter.field}`;
        }

        conditionExp = `REGEXP_CONTAINS(CAST(${sqlField} AS STRING), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(CAST(${convSqlField} AS STRING), r'${filter.value}')`;
      }

      // Handle "Exclude"
      if (filter.type === "Exclude") {
        conditionExp = `NOT ${conditionExp}`;
        conditionConv = `NOT ${conditionConv}`;
      }
      
      // Route to the correct CTE based on Target
      if (filter.target === "Experiment Event" || filter.target === "Both") {
        experimentFiltersSQL += `\n          AND ${conditionExp}`;
      }
      if (filter.target === "Conversion Event" || filter.target === "Both") {
        conversionFiltersSQL += `\n          AND ${conditionConv}`;
      }
    });

    // 2. Inject into the main SQL
    sql = `
      WITH target_users AS (
        SELECT user_pseudo_id, MIN(time.event_timestamp) as first_exposure_time
        FROM ${tablePath}
        WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
          AND event_name = '${targetEvent}'
          ${dataformParamCondition}
          ${experimentFiltersSQL}
        GROUP BY user_pseudo_id
      ),
      converting_users AS (
        SELECT DISTINCT t.user_pseudo_id
        FROM target_users t
        JOIN ${tablePath} e ON t.user_pseudo_id = e.user_pseudo_id
        WHERE e.event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
          AND e.event_name = '${conversionEvent}'
          AND e.time.event_timestamp >= t.first_exposure_time
          ${conversionFiltersSQL}
      )
      SELECT 
        (SELECT COUNT(user_pseudo_id) FROM target_users) / ${days} AS daily_traffic,
        (SELECT COUNT(user_pseudo_id) FROM converting_users) AS conversions,
        (SELECT COUNT(user_pseudo_id) FROM converting_users) / NULLIF((SELECT COUNT(user_pseudo_id) FROM target_users), 0) AS baseline_cr
    `;
  } else if (tool === "Google Analytics") {
    
    // 0. Handle the Base Experiment Parameter (Cells C8/C9) for Items
    let nativeGa4ParamCondition = "";
    if (targetParam && targetParamValue) {
      // NEW: Check if the base parameter is an Item/Array
      if (itemsObject && targetParam.startsWith(itemsObject + ".")) {
        const itemProp = targetParam.substring(itemsObject.length + 1);
        nativeGa4ParamCondition = `
          AND EXISTS (
            SELECT 1 FROM UNNEST(${itemsObject}) i 
            WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${targetParamValue}')
          )
        `;
      } else if (paramType === "Event") {
        nativeGa4ParamCondition = `
          AND EXISTS (
            SELECT 1 FROM UNNEST(event_params) ep 
            WHERE ep.key = '${targetParam}' 
            AND REGEXP_CONTAINS(COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.float_value AS STRING), CAST(ep.value.double_value AS STRING), ''), r'${targetParamValue}')
          )
        `;
      } else if (paramType === "Column") {
        nativeGa4ParamCondition = `AND REGEXP_CONTAINS(CAST(${targetParam} AS STRING), r'${targetParamValue}')`;
      }
    }

    // 1. Build the dynamic filter strings for Native GA4
    let experimentFiltersSQL = "";
    let conversionFiltersSQL = "";

    filters.forEach(filter => {
      let conditionExp = "";
      let conditionConv = "";

      // Check if it's an Array/Item field
      if (itemsObject && filter.field.startsWith(itemsObject + ".")) {
        const itemProp = filter.field.substring(itemsObject.length + 1); 
        
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(${itemsObject}) AS i WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(e.${itemsObject}) AS i WHERE REGEXP_CONTAINS(CAST(i.${itemProp} AS STRING), r'${filter.value}'))`;
        
      } else if (filter.scope === "Event") {
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(event_params) ep WHERE ep.key = '${filter.field}' AND REGEXP_CONTAINS(COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.float_value AS STRING), CAST(ep.value.double_value AS STRING), ''), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(e.event_params) ep WHERE ep.key = '${filter.field}' AND REGEXP_CONTAINS(COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.float_value AS STRING), CAST(ep.value.double_value AS STRING), ''), r'${filter.value}'))`;
      
      } else if (filter.scope === "User") {
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(user_properties) up WHERE up.key = '${filter.field}' AND REGEXP_CONTAINS(COALESCE(up.value.string_value, CAST(up.value.int_value AS STRING), CAST(up.value.float_value AS STRING), CAST(up.value.double_value AS STRING), ''), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(e.user_properties) up WHERE up.key = '${filter.field}' AND REGEXP_CONTAINS(COALESCE(up.value.string_value, CAST(up.value.int_value AS STRING), CAST(up.value.float_value AS STRING), CAST(up.value.double_value AS STRING), ''), r'${filter.value}'))`;
      
      } else {
        // Scope is 'Column'
        conditionExp = `REGEXP_CONTAINS(CAST(${filter.field} AS STRING), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(CAST(e.${filter.field} AS STRING), r'${filter.value}')`;
      }

      // Handle "Exclude"
      if (filter.type === "Exclude") {
        conditionExp = `NOT ${conditionExp}`;
        conditionConv = `NOT ${conditionConv}`;
      }
      
      // Route to the correct CTE
      if (filter.target === "Experiment Event" || filter.target === "Both") {
        experimentFiltersSQL += `\n          AND ${conditionExp}`;
      }
      if (filter.target === "Conversion Event" || filter.target === "Both") {
        conversionFiltersSQL += `\n          AND ${conditionConv}`;
      }
    });

    // 2. Inject into the main SQL
    const nativeTablePath = `\`${projectID}.${datasetID}.${tableID}*\``;
    sql = `
      WITH target_users AS (
        SELECT user_pseudo_id, MIN(event_timestamp) as first_exposure_time
        FROM ${nativeTablePath}
        WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)) AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
          AND event_name = '${targetEvent}'
          ${nativeGa4ParamCondition}
          ${experimentFiltersSQL}
        GROUP BY user_pseudo_id
      ),
      converting_users AS (
        SELECT DISTINCT t.user_pseudo_id
        FROM target_users t
        JOIN ${nativeTablePath} e ON t.user_pseudo_id = e.user_pseudo_id
        WHERE e._TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)) AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
          AND e.event_name = '${conversionEvent}'
          AND e.event_timestamp >= t.first_exposure_time
          ${conversionFiltersSQL}
      )
      SELECT 
        (SELECT COUNT(user_pseudo_id) FROM target_users) / ${days} AS daily_traffic,
        (SELECT COUNT(user_pseudo_id) FROM converting_users) AS conversions,
        (SELECT COUNT(user_pseudo_id) FROM converting_users) / NULLIF((SELECT COUNT(user_pseudo_id) FROM target_users), 0) AS baseline_cr
    `;
  } else if (tool === "Amplitude") {
    
    // 0. Handle the Base Experiment Parameter (Cells C8/C9) for Items
    let amplitudeParamCondition = "";
    if (targetParam && targetParamValue) {
      // NEW: Check if the base parameter is an Item/Array
      if (itemsObject && targetParam.startsWith(itemsObject + ".")) {
        const itemProp = targetParam.substring(itemsObject.length + 1);
        amplitudeParamCondition = `
          AND EXISTS (
            SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(event_properties, '$."${itemsObject}"')) AS item 
            WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${targetParamValue}')
          )
        `;
      } else if (paramType === "Event") {
        amplitudeParamCondition = `AND REGEXP_CONTAINS(JSON_VALUE(event_properties, '$."${targetParam}"'), r'${targetParamValue}')`;
      } else if (paramType === "Column") {
        amplitudeParamCondition = `AND REGEXP_CONTAINS(CAST(${targetParam} AS STRING), r'${targetParamValue}')`;
      }
    }

    // 1. Build the dynamic filter strings for Amplitude
    let experimentFiltersSQL = "";
    let conversionFiltersSQL = "";

    filters.forEach(filter => {
      let conditionExp = "";
      let conditionConv = "";

      // Check if it's an Array/Item field
      if (itemsObject && filter.field.startsWith(itemsObject + ".")) {
        const itemProp = filter.field.substring(itemsObject.length + 1); 
        
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(event_properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(e.event_properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        
      } else if (filter.scope === "Event") {
        conditionExp = `REGEXP_CONTAINS(JSON_VALUE(event_properties, '$."${filter.field}"'), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(JSON_VALUE(e.event_properties, '$."${filter.field}"'), r'${filter.value}')`;
        
      } else if (filter.scope === "User") {
        conditionExp = `REGEXP_CONTAINS(JSON_VALUE(user_properties, '$."${filter.field}"'), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(JSON_VALUE(e.user_properties, '$."${filter.field}"'), r'${filter.value}')`;
        
      } else {
        // Scope is 'Column'
        conditionExp = `REGEXP_CONTAINS(CAST(${filter.field} AS STRING), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(CAST(e.${filter.field} AS STRING), r'${filter.value}')`;
      }

      // Handle "Exclude"
      if (filter.type === "Exclude") {
        conditionExp = `NOT ${conditionExp}`;
        conditionConv = `NOT ${conditionConv}`;
      }
      
      // Route to the correct CTE
      if (filter.target === "Experiment Event" || filter.target === "Both") {
        experimentFiltersSQL += `\n          AND ${conditionExp}`;
      }
      if (filter.target === "Conversion Event" || filter.target === "Both") {
        conversionFiltersSQL += `\n          AND ${conditionConv}`;
      }
    });

    // 2. Inject into the main SQL
    sql = `
      WITH target_users AS (
        SELECT amplitude_id, MIN(event_time) as first_exposure_time
        FROM ${tablePath}
        WHERE event_time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND event_type = '${targetEvent}'
          ${amplitudeParamCondition}
          ${experimentFiltersSQL}
        GROUP BY amplitude_id
      ),
      converting_users AS (
        SELECT DISTINCT t.amplitude_id
        FROM target_users t
        JOIN ${tablePath} e ON t.amplitude_id = e.amplitude_id
        WHERE e.event_time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND e.event_type = '${conversionEvent}'
          AND e.event_time >= t.first_exposure_time
          ${conversionFiltersSQL}
      )
      SELECT 
        (SELECT COUNT(amplitude_id) FROM target_users) / ${days} AS daily_traffic,
        (SELECT COUNT(amplitude_id) FROM converting_users) AS conversions,
        (SELECT COUNT(amplitude_id) FROM converting_users) / NULLIF((SELECT COUNT(amplitude_id) FROM target_users), 0) AS baseline_cr
    `;
  } else if (tool === "Mixpanel") {
    
    // 0. Handle the Base Experiment Parameter (Cells C8/C9) for Items
    let mixpanelParamCondition = "";
    if (targetParam && targetParamValue) {
      // NEW: Check if the base parameter is an Item/Array
      if (itemsObject && targetParam.startsWith(itemsObject + ".")) {
        const itemProp = targetParam.substring(itemsObject.length + 1);
        mixpanelParamCondition = `
          AND EXISTS (
            SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(properties, '$."${itemsObject}"')) AS item 
            WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${targetParamValue}')
          )
        `;
      } else if (paramType === "Event") {
        mixpanelParamCondition = `AND REGEXP_CONTAINS(JSON_VALUE(properties, '$."${targetParam}"'), r'${targetParamValue}')`;
      } else if (paramType === "Column") {
        mixpanelParamCondition = `AND REGEXP_CONTAINS(CAST(${targetParam} AS STRING), r'${targetParamValue}')`;
      }
    }

    // 1. Build the dynamic filter strings for Mixpanel
    let experimentFiltersSQL = "";
    let conversionFiltersSQL = "";

    filters.forEach(filter => {
      let conditionExp = "";
      let conditionConv = "";

      // Check if it's an Array/Item field
      if (itemsObject && filter.field.startsWith(itemsObject + ".")) {
        const itemProp = filter.field.substring(itemsObject.length + 1); 
        
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(e.properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        
      } else if (filter.scope === "Event" || filter.scope === "User") {
        // Mixpanel groups both event and user scopes into 'properties'
        conditionExp = `REGEXP_CONTAINS(JSON_VALUE(properties, '$."${filter.field}"'), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(JSON_VALUE(e.properties, '$."${filter.field}"'), r'${filter.value}')`;
        
      } else {
        // Scope is 'Column'
        conditionExp = `REGEXP_CONTAINS(CAST(${filter.field} AS STRING), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(CAST(e.${filter.field} AS STRING), r'${filter.value}')`;
      }

      // Handle "Exclude"
      if (filter.type === "Exclude") {
        conditionExp = `NOT ${conditionExp}`;
        conditionConv = `NOT ${conditionConv}`;
      }
      
      // Route to the correct CTE
      if (filter.target === "Experiment Event" || filter.target === "Both") {
        experimentFiltersSQL += `\n          AND ${conditionExp}`;
      }
      if (filter.target === "Conversion Event" || filter.target === "Both") {
        conversionFiltersSQL += `\n          AND ${conditionConv}`;
      }
    });

    // 2. Inject into the main SQL
    sql = `
      WITH target_users AS (
        SELECT distinct_id, MIN(time) as first_exposure_time
        FROM ${tablePath}
        WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND event_name = '${targetEvent}'
          ${mixpanelParamCondition}
          ${experimentFiltersSQL}
        GROUP BY distinct_id
      ),
      converting_users AS (
        SELECT DISTINCT t.distinct_id
        FROM target_users t
        JOIN ${tablePath} e ON t.distinct_id = e.distinct_id
        WHERE e.time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND e.event_name = '${conversionEvent}'
          AND e.time >= t.first_exposure_time
          ${conversionFiltersSQL}
      )
      SELECT 
        (SELECT COUNT(distinct_id) FROM target_users) / ${days} AS daily_traffic,
        (SELECT COUNT(distinct_id) FROM converting_users) AS conversions,
        (SELECT COUNT(distinct_id) FROM converting_users) / NULLIF((SELECT COUNT(distinct_id) FROM target_users), 0) AS baseline_cr
    `;
  } else if (tool === "PostHog") {
    
    // 0. Handle the Base Experiment Parameter (Cells C8/C9) for Items
    let posthogParamCondition = "";
    if (targetParam && targetParamValue) {
      // NEW: Check if the base parameter is an Item/Array
      if (itemsObject && targetParam.startsWith(itemsObject + ".")) {
        const itemProp = targetParam.substring(itemsObject.length + 1);
        posthogParamCondition = `
          AND EXISTS (
            SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(properties, '$."${itemsObject}"')) AS item 
            WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${targetParamValue}')
          )
        `;
      } else if (paramType === "Event") {
        posthogParamCondition = `AND REGEXP_CONTAINS(JSON_VALUE(properties, '$."${targetParam}"'), r'${targetParamValue}')`;
      } else if (paramType === "Column") {
        posthogParamCondition = `AND REGEXP_CONTAINS(CAST(${targetParam} AS STRING), r'${targetParamValue}')`;
      }
    }

    // 1. Build the dynamic filter strings for PostHog
    let experimentFiltersSQL = "";
    let conversionFiltersSQL = "";

    filters.forEach(filter => {
      let conditionExp = "";
      let conditionConv = "";

      // Check if it's an Array/Item field
      if (itemsObject && filter.field.startsWith(itemsObject + ".")) {
        const itemProp = filter.field.substring(itemsObject.length + 1); 
        
        conditionExp = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        conditionConv = `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(e.properties, '$."${itemsObject}"')) AS item WHERE REGEXP_CONTAINS(JSON_VALUE(item, '$."${itemProp}"'), r'${filter.value}'))`;
        
      } else if (filter.scope === "Event" || filter.scope === "User") {
        // PostHog groups both event and user scopes into 'properties'
        conditionExp = `REGEXP_CONTAINS(JSON_VALUE(properties, '$."${filter.field}"'), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(JSON_VALUE(e.properties, '$."${filter.field}"'), r'${filter.value}')`;
        
      } else {
        // Scope is 'Column'
        conditionExp = `REGEXP_CONTAINS(CAST(${filter.field} AS STRING), r'${filter.value}')`;
        conditionConv = `REGEXP_CONTAINS(CAST(e.${filter.field} AS STRING), r'${filter.value}')`;
      }

      // Handle "Exclude"
      if (filter.type === "Exclude") {
        conditionExp = `NOT ${conditionExp}`;
        conditionConv = `NOT ${conditionConv}`;
      }
      
      // Route to the correct CTE
      if (filter.target === "Experiment Event" || filter.target === "Both") {
        experimentFiltersSQL += `\n          AND ${conditionExp}`;
      }
      if (filter.target === "Conversion Event" || filter.target === "Both") {
        conversionFiltersSQL += `\n          AND ${conditionConv}`;
      }
    });

    // 2. Inject into the main SQL
    sql = `
      WITH target_users AS (
        SELECT distinct_id, MIN(timestamp) as first_exposure_time
        FROM ${tablePath}
        WHERE timestamp >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND event = '${targetEvent}'
          ${posthogParamCondition}
          ${experimentFiltersSQL}
        GROUP BY distinct_id
      ),
      converting_users AS (
        SELECT DISTINCT t.distinct_id
        FROM target_users t
        JOIN ${tablePath} e ON t.distinct_id = e.distinct_id
        WHERE e.timestamp >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY))
          AND e.event = '${conversionEvent}'
          AND e.timestamp >= t.first_exposure_time
          ${conversionFiltersSQL}
      )
      SELECT 
        (SELECT COUNT(distinct_id) FROM target_users) / ${days} AS daily_traffic,
        (SELECT COUNT(distinct_id) FROM converting_users) AS conversions,
        (SELECT COUNT(distinct_id) FROM converting_users) / NULLIF((SELECT COUNT(distinct_id) FROM target_users), 0) AS baseline_cr
    `;
  }

  // --- ESTIMATE COST (DRY RUN) ---
  ss.toast("Estimating query cost...", "Thinking", 3);
  const costEstimate = estimateQueryCost(projectID, sql, queryPricePerTiB); // Passes dynamic price
  
  if (costEstimate) {
    const ui = SpreadsheetApp.getUi();
    const userResponse = ui.alert(
      "Confirm BigQuery Execution",
      `You are about to query ${days} days of historical data.\n\n` +
      `Estimated Data Scanned: ${costEstimate.gigabytes} GB\n` +
      `Estimated Cost: $${costEstimate.costUsd} USD\n\n` +
      `Do you want to proceed and run this query?`,
      ui.ButtonSet.YES_NO
    );
    
    if (userResponse !== ui.Button.YES) {
      ss.toast("Query cancelled.", "Aborted", 3);
      return; 
    }
  } else {
    const ui = SpreadsheetApp.getUi();
    const userResponse = ui.alert(
      "Warning",
      "Could not estimate query cost. The query might contain errors or be too complex. Do you want to try running it anyway?",
      ui.ButtonSet.YES_NO
    );
    if (userResponse !== ui.Button.YES) {
      ss.toast("Query cancelled.", "Aborted", 3);
      return;
    }
  }

  // --- EXECUTE QUERY ---
  ss.toast("Running BigQuery execution...", "Executing", 5);
  const bqResults = executeBigQuery(projectID, sql);
  
  // --- WRITE RESULTS BACK TO SHEET ---
  if (bqResults && bqResults.length > 0) {
    const dailyTraffic = bqResults[0][0];
    const conversions = bqResults[0][1];
    const baselineCR = bqResults[0][2];
    
    sheet.getRange("C19").setValue(dailyTraffic).setNumberFormat("0");       
    sheet.getRange("C20").setValue(conversions).setNumberFormat("0");        
    sheet.getRange("C21").setValue(baselineCR).setNumberFormat("0.00%");     
    
    ss.toast("Calculation complete! Sample sizes updated.", "Success", 5);
  } else {
    ss.toast("Query returned no results.", "Warning", 5);
  }
}

/**
 * Helper function to run the BigQuery Job
 */
function executeBigQuery(projectId, query) {
  const request = { query: query, useLegacySql: false };
  try {
    let queryResults = BigQuery.Jobs.query(request, projectId); 
    const jobId = queryResults.jobReference.jobId;
    
    let sleepTimeMs = 500;
    // Now it can safely update the variable while it waits!
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId); 
    }
    
    const rows = queryResults.rows;
    if (!rows) return [];
    return rows.map(row => row.f.map(col => col.v));
    
  } catch (err) {
    SpreadsheetApp.getUi().alert("BigQuery Error: " + err.message);
    return null;
  }
}

/**
 * Helper function to estimate query cost
 */
function estimateQueryCost(projectId, query, pricePerTiB) {
  const job = {
    configuration: {
      query: {
        query: query,
        useLegacySql: false
      },
      dryRun: true
    }
  };
  
  try {
    const dryRunResult = BigQuery.Jobs.insert(job, projectId);
    const bytesProcessed = dryRunResult.statistics.totalBytesProcessed;
    
    const tbProcessed = bytesProcessed / 1099511627776; 
    const estimatedCost = tbProcessed * pricePerTiB; 
    
    const gbProcessed = (bytesProcessed / 1073741824).toFixed(2);
    
    return {
      gigabytes: gbProcessed,
      costUsd: estimatedCost.toFixed(4)
    };
  } catch (err) {
    Logger.log("Dry run failed: " + err.message);
    return null;
  }
}

/**
 * Inserts a new filter row starting at row 27.
 * Automatically adds new rows to the sheet if it hits the bottom.
 */
function calculatorAddFilterRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Calculator");
  
  const startRow = 27;
  
  // 1. Safety Check: Ensure the sheet has at least 27 rows to begin with
  if (sheet.getMaxRows() < startRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), startRow - sheet.getMaxRows());
  }

  let currentRow = startRow;
  
  // 2. Find the next empty row in the filter block safely
  while (currentRow <= sheet.getMaxRows() && sheet.getRange("B" + currentRow).getValue() !== "") {
    currentRow++;
  }
  
  // 3. Insert a new row (either push existing rows down, or expand the sheet)
  if (currentRow > startRow) {
    if (currentRow > sheet.getMaxRows()) {
      sheet.insertRowAfter(sheet.getMaxRows()); // We are at the bottom, add a new row
    } else {
      sheet.insertRowBefore(currentRow); // We are in the middle, push rows down
    }
  }
  
  // --- SET DATA VALIDATIONS ---
  
  // Column B: Filter Type
  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(['Include', 'Exclude']).build();
  sheet.getRange("B" + currentRow).setDataValidation(typeRule).setValue('Include');
  
  // Column C: Filter On Value
  const targetRule = SpreadsheetApp.newDataValidation().requireValueInList(['Experiment Event', 'Conversion Event', 'Both']).build();
  sheet.getRange("C" + currentRow).setDataValidation(targetRule).setValue('Both');
  
  // Column D: Filter Scope (Dynamic from Lookup_Filter_Fields)
  const lookupSheet = ss.getSheetByName("Lookup_Filter_Fields");
  if (lookupSheet) {
    const lastRow = lookupSheet.getLastRow();
    if (lastRow > 1) {
      const scopeValues = lookupSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const uniqueScopes = [...new Set(scopeValues.map(row => row[0]).filter(String))];
      const scopeRule = SpreadsheetApp.newDataValidation().requireValueInList(uniqueScopes).build();
      sheet.getRange("D" + currentRow).setDataValidation(scopeRule).setValue('');
    }
  }
  
  // Column E & F: Ensure they are completely blank and validation-free
  sheet.getRange("E" + currentRow).clearDataValidations().setValue('');
  sheet.getRange("F" + currentRow).clearDataValidations().setValue('');
  
  // Clean up formatting
  sheet.getRange(currentRow, 2, 1, 5).setBackground('#ffffff').setBorder(true, true, true, true, true, true);
}

/**
 * Deletes all dynamically inserted filter rows and resets row 27.
 */
function calculatorDeleteAllFilters() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Calculator");
  
  const startRow = 27;
  
  // If the sheet doesn't even have 27 rows, there is nothing to delete
  if (sheet.getMaxRows() < startRow) return;
  
  let currentRow = startRow;
  let count = 0;
  
  // Count exactly how many filter rows currently exist safely
  while (currentRow <= sheet.getMaxRows() && sheet.getRange("B" + currentRow).getValue() !== "") {
    count++;
    currentRow++;
  }
  
  if (count > 0) {
    // 1. Reset Row 27 completely
    sheet.getRange("B27:F27").clearContent().clearDataValidations().setBorder(false, false, false, false, false, false).setBackground(null);
    
    // 2. Physically delete all extra inserted rows (Row 29 onwards)
    if (count > 1) {
      sheet.deleteRows(startRow + 1, count - 1);
    }
  }
}