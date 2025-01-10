// Mapping of indicator names to their summary cell and update row
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

function doPost(e) {
  try {
    // Parse the JSON data from the request body
    var data = JSON.parse(e.postData.contents);

    // Validate the required keys in the JSON data
    if (!data.indicator || data.sd_minus_2 === undefined || data.sd_plus_2 === undefined || data.todays_value === undefined) {
      return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': 'Missing required keys in JSON data' }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // Convert string decimals to numbers using parseFloat
    var sd_minus_2 = parseFloat(data.sd_minus_2);
    var sd_plus_2 = parseFloat(data.sd_plus_2);
    var todays_value = parseFloat(data.todays_value);

    // Get the current date and time in Riga/Europe time zone
    var currentDate = new Date();
    var formattedDate = Utilities.formatDate(currentDate, "Europe/Riga", "yyyy-MM-dd HH:mm:ss");

    // Calculate Mean, Standard Deviation, and Z-Score
    var mean = (sd_minus_2 + sd_plus_2) / 2;
    var standardDeviation = (sd_plus_2 - sd_minus_2) / 4;
    var zScore = (todays_value - mean) / standardDeviation;

    // Round the Z-Score to two decimal places
    zScore = Math.round(zScore * 100) / 100;

    // Open the spreadsheet
    var spreadsheet = SpreadsheetApp.openById("1qn6R5Md6NLS3qPtBhzvQU8glAiCPu2n5BwplZHz2N7w");
    var sheet = spreadsheet.getSheetByName("Automated TV Webhook");

    // Get the specific row and summary cell for the current indicator
    var cellInfo = indicatorToCell[data.indicator];

    if (cellInfo) {
      // Use the update_row for updating values instead of adding a new row
      var updateRow = cellInfo.update_row;

      // Set values in the specified row, starting from the first column (A)
      sheet.getRange(updateRow, 1).setValue(formattedDate);        // Set current date and time
      sheet.getRange(updateRow, 2).setValue(data.indicator);
      sheet.getRange(updateRow, 3).setValue(sd_minus_2);           // Use converted decimal values
      sheet.getRange(updateRow, 4).setValue(sd_plus_2);            // Use converted decimal values
      sheet.getRange(updateRow, 5).setValue(todays_value);         // Use converted decimal values
      sheet.getRange(updateRow, 6).setValue(mean);                 // Insert calculated Mean
      sheet.getRange(updateRow, 7).setValue(standardDeviation);    // Insert calculated Standard Deviation
      sheet.getRange(updateRow, 8).setValue(zScore);               // Insert rounded Z-Score

      // Update the summary cell for Z-score
      var summarySheet = spreadsheet.getSheetByName("SDCA v2");
      summarySheet.getRange(cellInfo.summary_cell).setValue(zScore);
    } else {
      // Handle case where indicator is not found in the mapping
      return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': 'Indicator not found in mapping' }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // Return success message
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'success' }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return error message if something goes wrong
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}