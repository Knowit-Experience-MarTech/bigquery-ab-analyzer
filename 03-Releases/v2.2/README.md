# v2.2 - Improved UX for Funnels & Filters

* This upgrades the version from **v.2.1** to **v2.2**.
* This upgrade makes it easier to create Funnels & Filters.

How to upgrade is described below.

## 1. Google Cloud

### 1.1 Update BigQuery Tables
* Copy [**Create-Tables-and-UDF.sql**](../../01-Documentation/Google-Cloud/01-BigQuery/Create-Tables-and-UDF.sql).
	* Set data set location (EU or US).
	* Replace "your_project" with your project.
	* Run Create-Tables-and-UDF.sql.

## 2. Google Sheet

* Either make a copy of the [**new Google Sheet**](https://docs.google.com/spreadsheets/d/1UC2CyflDU20liWG4QWxXLJWaBPh5A3GPgbSNDt-EKN0/edit?usp=sharing) and use that, OR follow the instructions below.

### 2.1 Sheets

#### 2.1.1 Experiments Sheet

1. Delete the **Advanced Settings:** text.
2. Delete/remove the **Show/Hide** dropdown.

#### 2.1.2 Funnels Sheet
Funnels Sheet will no longer have any functionality. It will only be used as a database.

1. Delete the **Button** in the **Funnels** sheet.
2. Hide the sheet (optional).

#### 2.1.3 Filters Sheet
Filters Sheet will no longer have any functionality. It will only be used as a database.

1. Delete ALL **Buttons** in the **Filters** sheet.
2. Hide the sheet (optional).

#### 2.1.4 Settings Sheet

* When you have made all the updates, change **Version** in the **About** section to **v2.2**.

### 2.2 Apps Script

* In the Google Sheet menu, go to **Extensions -> Apps Script**.

#### 2.2.1 Replace Apps Script

Replace the following Apps Script:

1. [**01_Generic.gs**](../../01-Documentation/Google-Sheet/Apps-Script/01_Generic.gs)
2. [**02_Filters.gs**](../../01-Documentation/Google-Sheet/Apps-Script/02_Filters.gs)
3. [**03_BigQuery_Upload.gs**](../../01-Documentation/Google-Sheet/Apps-Script/03_BigQuery_Upload.gs)
	
#### 2.2.2 Run Apps Script once

1. If [**07_Extra.gs**](../../01-Documentation/Google-Sheet/Apps-Script/07_Extra.gs) doesn't exist, create it. 
2. Delete **empty function**.
3. Add this function, and **Save**.
```javascript
function runOnceMasterMigration() {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const expSheet = ss.getSheetByName(experimentSheetName);
const filterSheet = ss.getSheetByName(filtersSheetName);
const funnelSheet = ss.getSheetByName(funnelSheetName)
if (!filterSheet || !expSheet || !funnelSheet) {
	SpreadsheetApp.getUi().alert("Error: Sheets not found.");
	return;
}
// --- 1. CLEANUP FILTERS DATABASE ---
try {
	filterSheet.deleteColumn(9); // Deletes Notes (I)
	filterSheet.deleteColumn(3); // Deletes Enabled (C)
} catch (e) { }
filterSheet.getDataRange().clearDataValidations();
funnelSheet.getDataRange().clearDataValidations();
// --- 2. MIGRATE SIMPLE FILTERS ---
const lastRow = expSheet.getLastRow();
let migratedCount = 0;
let newFilterData = [];
for (let r = firstRow; r <= lastRow; r += 2) { 
	const isFilterOn = String(expSheet.getRange(r, filterColumn).getValue()).trim().toLowerCase() === 'yes';
	const isAdvFilterOn = expSheet.getRange(r, 19).getValue() === true; // Col 19 is Advanced
	if (isFilterOn && !isAdvFilterOn) {
	const expId = expSheet.getRange(r, idColumn).getValue();
	const filterField = expSheet.getRange(r, 23).getValue(); // Old Filter Field
	if (expId && filterField) {
		newFilterData.push([
		expId,
		"Both", 
		expSheet.getRange(r, 20).getValue() || "Include", // Old Type
		expSheet.getRange(r, 21).getValue() || "Both",    // Old On Value
		expSheet.getRange(r, 22).getValue() || "Event",   // Old Scope
		filterField,
		expSheet.getRange(r, 24).getValue() || ""         // Old Value
		]);
		migratedCount++;
	}
	}
}
if (newFilterData.length > 0) {
	const insertRow = Math.max(2, filterSheet.getLastRow() + 1); 
	filterSheet.getRange(insertRow, 1, newFilterData.length, 7).setValues(newFilterData);
	for (let i = 0; i < newFilterData.length; i++) {
	const bgColor = ((insertRow + i) % 2 !== 0) ? '#f1f1f1' : '#ffffff';
	filterSheet.getRange(insertRow + i, 1, 1, 7).setBackground(bgColor).setFontColor('#000000').setFontWeight('normal');
	}
}
// --- 3. CONVERT COLUMN R TO CHECKBOXES ---
let activeFilters = 0;
for (let r = firstRow; r <= lastRow; r++) {
	const cell = expSheet.getRange(r, filterColumn);
	const cellValue = String(cell.getValue()).trim().toLowerCase();
	if (cell.getDataValidation() && cell.getDataValidation().getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX) continue;
	cell.clearDataValidations();
	cell.insertCheckboxes();
	if (cellValue === "yes") {
		cell.setValue(true);
		activeFilters++;
	} else {
		cell.setValue(false);
	}
}
// --- 4. DELETE COLUMNS S THROUGH X ---
// We check the header of column 19 to make sure we don't accidentally delete columns twice!
const col19Header = String(expSheet.getRange(firstRow - 1, 19).getValue()).toLowerCase();
if (col19Header.includes("adv")) {
	expSheet.deleteColumns(19, 6); // Deletes 6 columns starting at 19 (S through X)
}
SpreadsheetApp.getUi().alert(`Migration Complete!\n\n- Migrated ${migratedCount} simple filters.\n- Converted Filter column to checkboxes.\n- Deleted columns S through X.`);
}
```
3. Run **runOnceMasterMigration** function only once.
	1. Columns will be deleted in **Experiments** & **Filters** sheet.
4. **Delete** the function, and **Save**.
	
#### 2.2.3 Create FunnelModal.html

1. Click **Add a file**
	1. **+** sign in **Files** "menu"
2. Choose **HTML**
3. Name the file **FunnelModal**
	1. Hit **Enter**
4. Delete existing code in **FunnelModal.html**.
5. Copy code from [**FunnelModal.html**](../../01-Documentation/Google-Sheet/Apps-Script/FunnelModal.html), and paste it into **FunnelModal.html** that you just created.
6. **Save**

#### 2.2.4 Create FilterModal.html

1. Click **Add a file**
	1. **+** sign in **Files** "menu"
2. Choose **HTML**
3. Name the file **FilterModal**
	1. Hit **Enter**
4. Delete existing code in **FilterModal.html**.
5. Copy code from [**FilterModal.html**](../../01-Documentation/Google-Sheet/Apps-Script/FilterModal.html), and paste it into **FilterModal.html** that you just created.
6. **Save**

#### 2.2.5 Create Trigger

1. Go to **Triggers**
2. Click **Add Trigger**
	1. **Choose which function to run**: installedOnEdit
	2. **Which runs at deployment**: Head
	3. **Select event source**: From spreadsheet
	4. **Select event type**: On edit
	5. **Save**

## 3. Upgrade completed

If everything went smooth, upgrade is now completed.

Don't forget to change **Version** in the **About** section to **v2.1** in **Settings sheet**.