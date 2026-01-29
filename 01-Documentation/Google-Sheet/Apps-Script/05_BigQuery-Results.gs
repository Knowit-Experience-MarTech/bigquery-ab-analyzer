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
    "SELECT id, experiment_name, date_last_analyzed, date_start, date_end, hypothesis, confidence_level, analyze_test, user_overlap, conversion_event, conv_significance, conv_details, value_significance, value_details, scope, identity_source, test_a, conversion_a, test_b, conversion_b, conv_rate_a, conv_rate_b, conv_z_score, conv_p_value, mean_value_a, mean_value_b, t_value, value_p_value " +
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
    resultsSheet.getRange(firstRow, 1, data.length, 2).setNumberFormat("00");
    resultsSheet.getRange(firstRow, 2, data.length, 1).setNumberFormat("yyyy-mm-dd hh:mm");
    
    resultsSheet.getRange(firstRow, 4, data.length, 1).setNumberFormat("#,##0");
    resultsSheet.getRange(firstRow, 5, data.length, 1).setHorizontalAlignment("right")
    resultsSheet.getRange(firstRow, 6, data.length, 2).setNumberFormat("$#,##0.00");
    resultsSheet.getRange(firstRow, 7, data.length, 1).insertCheckboxes().setHorizontalAlignment("center");
    resultsSheet.getRange(firstRow, 1, firstRow-1, resultsSheet.getMaxColumns()).setWrap(true).setVerticalAlignment("top");
    
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