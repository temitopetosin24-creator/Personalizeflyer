const ANALYTICS_SHEET_NAME = 'Analytics';
const SUMMARY_SHEET_NAME = 'Summary';
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function setup() {
  ensureSheets_();
}

function doGet() {
  return ContentService.createTextOutput('Analytics endpoint is active. View counts in the private Google Sheet.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(request) {
  const contents = request && request.postData && request.postData.contents;
  if (!contents || contents.length > 1024) return textResponse_('Invalid request');

  let payload;
  try {
    payload = JSON.parse(contents);
  } catch (error) {
    return textResponse_('Invalid request');
  }

  if (!payload || !VISITOR_ID_PATTERN.test(payload.visitorId || '') ||
      !['visit', 'personalized'].includes(payload.event)) {
    return textResponse_('Invalid request');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheets = ensureSheets_();
    const analytics = sheets.analytics;
    const lastRow = analytics.getLastRow();
    const existingRows = lastRow > 1
      ? analytics.getRange(2, 1, lastRow - 1, 2).getValues()
      : [];
    const existingIndex = existingRows.findIndex(row => row[0] === payload.visitorId);
    const isCreator = payload.event === 'personalized';

    if (existingIndex < 0) {
      analytics.appendRow([payload.visitorId, isCreator]);
    } else if (isCreator && existingRows[existingIndex][1] !== true) {
      analytics.getRange(existingIndex + 2, 2).setValue(true);
    }
  } finally {
    lock.releaseLock();
  }

  return textResponse_('OK');
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Bind this script to the analytics Google Sheet.');

  let analytics = spreadsheet.getSheetByName(ANALYTICS_SHEET_NAME);
  if (!analytics) analytics = spreadsheet.insertSheet(ANALYTICS_SHEET_NAME);
  if (analytics.getLastRow() === 0) {
    analytics.appendRow(['Visitor ID', 'Created named flyer']);
    analytics.setFrozenRows(1);
  }

  let summary = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summary) summary = spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
  if (summary.getLastRow() === 0) {
    summary.getRange(1, 1, 3, 2).setValues([
      ['Metric', 'Count'],
      ['Unique visitors', ''],
      ['Named flyer creators', '']
    ]);
    summary.getRange('B2').setFormula(`=COUNTA(${ANALYTICS_SHEET_NAME}!A2:A)`);
    summary.getRange('B3').setFormula(`=COUNTIF(${ANALYTICS_SHEET_NAME}!B2:B,TRUE)`);
    summary.setFrozenRows(1);
  }

  return { analytics, summary };
}

function textResponse_(message) {
  return ContentService.createTextOutput(message).setMimeType(ContentService.MimeType.TEXT);
}