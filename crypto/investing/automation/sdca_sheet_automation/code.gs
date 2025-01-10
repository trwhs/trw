const SHEET_ID = "1qn6R5Md6NLS3qPtBhzvQU8glAiCPu2n5BwplZHz2N7w";

const spreadsheet = SpreadsheetApp.openById(SHEET_ID);

const logSheet = spreadsheet.getSheetByName("Logs") || spreadsheet.insertSheet("Logs");

const webhookSheet = spreadsheet.getSheetByName("Automated TV Webhook");
const summarySheet = spreadsheet.getSheetByName("SDCA v2");

var indicatorToCell = {
  "MVRV": { summary_cell: "I5", update_row: 2 },
  "BMO": { summary_cell: "I6", update_row: 3 },
  "NUPL": { summary_cell: "I7", update_row: 4 },
  "RPO": { summary_cell: "I8", update_row: 5 },
  "SOPR": { summary_cell: "I9", update_row: 6 },
  "CM": { summary_cell: "I10", update_row: 7 },
  "Thermocap": { summary_cell: "I11", update_row: 8 },
  "PI": { summary_cell: "I13", update_row: 9 },
  "PowerLaw": { summary_cell: "I14", update_row: 10 },
  "PolyLog": { summary_cell: "I15", update_row: 11 },
  "CMO": { summary_cell: "I16", update_row: 12 },
  "RSI": { summary_cell: "I17", update_row: 13 },
  "MM": { summary_cell: "I18", update_row: 14 },
  "Overconfidence": { summary_cell: "I19", update_row: 15 },
  "FearGreed": { summary_cell: "I22", update_row: 16 },
  "TimeDifferential": { summary_cell: "I23", update_row: 17 },
};

function logEvent(message, details) {
  // Insert a new row at the top of the logs sheet
  logSheet.insertRowBefore(1);
  
  // Write the data to the new top row
  // Customize the columns as needed
  logSheet.getRange(1, 1, 1, 3).setValues([[
    new Date(),    // Timestamp
    message,       // Log message 
    JSON.stringify(details) // Details (converted to string)
  ]]);
}

function getBMOValue() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const webhookSheet = spreadsheet.getSheetByName("Automated TV Webhook");
    
    // Check last update time from the sheet
    const lastUpdateTime = webhookSheet.getRange(indicatorToCell["BMO"].update_row, 1).getValue();
    const currentTime = new Date();
    
    // If lastUpdateTime exists and it's been less than a minute, skip update
    if (lastUpdateTime && typeof lastUpdateTime.getTime === 'function') {
      const timeDiff = (currentTime - lastUpdateTime) / 1000;
      if (timeDiff < 60) {
        return null;
      }
    }

    const timestamp = currentTime.getTime();
    const url = `https://woocharts.com/bitcoin-macro-oscillator/data/chart.json?${timestamp}`;
    
    const response = UrlFetchApp.fetch(url, {
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://woocharts.com/bitcoin-macro-oscillator/'
      },
      'muteHttpExceptions': true
    });
    
    const data = JSON.parse(response.getContentText());
    if ('index' in data && 'y' in data['index']) {
      var bmo = data['index']['y'][data['index']['y'].length - 1];
      var formattedBmoValue = Math.round(bmo * 100) / 100;
      return formattedBmoValue;
    }
    return null;
  } catch (error) {
    logEvent("Error fetching BMO value", {
      error: error,
    });
    return null;
  }
}

// Common function to update any indicator's row and summary
function updateIndicator(sheet, summarySheet, indicator, todays_value, sd_minus_2, sd_plus_2, formattedDate) {
  const cellInfo = indicatorToCell[indicator];
  if (!cellInfo) return false;

  const mean = (sd_minus_2 + sd_plus_2) / 2;
  const standardDeviation = (sd_plus_2 - sd_minus_2) / 4;
  const zScore = Math.round((todays_value - mean) / standardDeviation * 100) / 100;

  // Update the row
  sheet.getRange(cellInfo.update_row, 1).setValue(formattedDate);
  sheet.getRange(cellInfo.update_row, 2).setValue(indicator);
  sheet.getRange(cellInfo.update_row, 3).setValue(sd_minus_2);
  sheet.getRange(cellInfo.update_row, 4).setValue(sd_plus_2);
  sheet.getRange(cellInfo.update_row, 5).setValue(todays_value);
  sheet.getRange(cellInfo.update_row, 6).setValue(mean);
  sheet.getRange(cellInfo.update_row, 7).setValue(standardDeviation);
  sheet.getRange(cellInfo.update_row, 8).setValue(zScore);

  // Update summary
  summarySheet.getRange(cellInfo.summary_cell).setValue(zScore);
  return true;
}


function doPost(e) {
  try {

    logEvent("Request received", {
      contents: e.postData.contents,
    });
    
    var data = JSON.parse(e.postData.contents);

    if (!data.indicator || data.sd_minus_2 === undefined || data.sd_plus_2 === undefined || data.todays_value === undefined) {
      logEvent("Error: Missing required keys in JSON data", {
        contents: e.postData.contents,
      });
      return;
    }

    var currentDate = new Date();
    var formattedDate = Utilities.formatDate(currentDate, "Europe/Riga", "yyyy-MM-dd HH:mm:ss");
    
    try {
        // Process the original indicator data
        const sd_minus_2 = parseFloat(data.sd_minus_2);
        const sd_plus_2 = parseFloat(data.sd_plus_2);
        const todays_value = parseFloat(data.todays_value);

        var mean = (sd_minus_2 + sd_plus_2) / 2;
        var standardDeviation = (sd_plus_2 - sd_minus_2) / 4;
        var zScore = (todays_value - mean) / standardDeviation;

        zScore = Math.round(zScore * 100) / 100;

    } catch (error) {
        logSheet.insertRowBefore(1);
        logSheet.getRange(1, 1, 1, 3).setValues([[
            new Date(), 
            'Z-Score Calculation Error', 
            error.message
        ]]);
    }

    const bmoValue = getBMOValue();

    logEvent("BMO", {
      value: bmoValue,
    });

    if (bmoValue !== null) {
      updateIndicator(webhookSheet, summarySheet, "BMO", bmoValue, 1.87, -1.8, formattedDate);
    }

    var update = updateIndicator(sheet, summarySheet, data.indicator, todays_value, sd_minus_2, sd_plus_2, formattedDate);

    if (!update) {
      logEvent("update results", {
        value: "failure",
      });
      return;
    }

    return ContentService.createTextOutput(JSON.stringify({ 'result': 'success' }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}