Const = {
  spreadSheetId: "XXXXXXXXXXXXXXXXXXXX", // 直近のサーモンランの情報
  sheetName: "salmonRun",
  token: "xoxp-XXXXXXXXXXXXXXXXXXXX", //Splathon
  channelId: "C9Y029JR0", //サーモンラン
  APIURL: "https://spla2.yuu26.com/coop/schedule",
  RES_TYPE_CHANNEL:"in_channel", //全体通知
  RES_TYPE_EPHEMERAL:"ephemeral" //自分だけ通知
}
SalmonRunSheet = {
  START: 1,
  END: 2,
  STAGENAME: 3,
  STATUS: 4
}
ImgUrl = {
  SAKETOBA_NORMAL: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/syaketoba_normal.png",
  SAKETOBA_MICHI: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/syaketoba_michishio.png",
  DONBURAKO_NORMAL: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/donburako_normal.png",
  DONBURAKO_MICHI: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/donburako_michishio.png",
  SYEKENA_NORMAL: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/syekenadamu_normal.png",
  SYEKENA_MICHI: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/syekenadamu_michishio.png",
  TOKI_NORMAL: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/tokishirazu_normal.png",
  TOKI_MICHI: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/tokishirazu_michishio.png",
  DUMMY: "https://raw.githubusercontent.com/splathon/KanketsusenBot/master/res/dummy.png"
}

function doPost(e) {
  var request = parseRequest(e);
  var msg;
  var resType = Const.RES_TYPE_EPHEMERAL
  var attachments;
  var info = null;
  if (request.text == "" || request.text == null) {
    /* 現在のカンケツセンを表示する */
    info = loadSalmonRunInfo();
  } else if(request.text == "help" || request.text == "h") {
    msg = "*【コマンド説明】*\n`/sake help -> ヘルプ表示`\n`/sake -> 直近のカンケツセンの情報を表示`"
  } else {
    msg = "コマンド間違ってるかもよ。\n`/sake h` で確認してね！"
  }

  return encode2Json(resType, msg, info);
}

function parseRequest(e) {
  var request = {};
  request.text = e.parameters["text"][0];
  request.user_name = e.parameters["user_name"][0]
  return request;
}

function encode2Json(responseType, msg, info) {
  responseType = Const.RES_TYPE_EPHEMERAL
  var res;
  if (info == null || info == undefined) {
     res = {
       "response_type" : responseType,
       "text": msg,
     }
  } else {
    var images = getKanketsusenImages(info.stageName);
    msg = createMessage(info);
     res = {
       "response_type" : responseType,
       "text": msg,
       "attachments" : [{
         "color" : "#36a64f",
         "title": "通常",
         "image_url" : images.normal
       },
       {
         "color" : "#3AA3E3",
         "title": "満潮",
         "image_url" : images.michi
       }]
     }
  }
  var json = JSON.stringify(res);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* 定期実行される関数 */
function timer() {
  main()
}

/* メイン関数 */
function main() {
  if(isNeedUpdateInfo()) {
    updateSalmonRunInfo();
    updateDoNotifyStatus(false);
  }

  if(isNeedNotify()) {
    notifyKanketsusen();
    updateDoNotifyStatus(true);
  }
}

/* 保存されているサーモンランの情報をもとに、サーバーへの再取得が必要かどうかを調べる */
function isNeedNotify() {
  /* サーモンランの開始時刻と、現在時刻を比較し、1時間以内に開始する、かつ、通知を行っていない場合にTrue.それ以外はFalse */
  var info = loadSalmonRunInfo();
  if (info.status) {
    return false;
  }
  var now = Moment.moment();
  var nowPlus1H = now.add(1, "h");
  var start = Moment.moment(info.start);
  return nowPlus1H.isAfter(start);
}

/* ローカルの情報の更新が必要かどうかを調べる */
function isNeedUpdateInfo() {
  /* サーモンランの終了時刻と現在の時刻を比較し、既に終わっているならばTrue.それ以外はFalse */
  var info = loadSalmonRunInfo();
  var now = Moment.moment();
  var end = Moment.moment(info.end);
  return now.isAfter(end);
}

/* サーバーからサーモンランの情報を取得し、更新する */
function updateSalmonRunInfo() {
  var res = UrlFetchApp.fetch(Const.APIURL);
  var json = JSON.parse(res.getContentText());
  var start = json["result"]["0"]["start"];
  var end = json["result"]["0"]["end"];
  var stageName = json["result"]["0"]["stage"]["name"];
  saveSalmonRunInfo(start, end, stageName);
}

/* サーモンランの情報をシートに保存する */
function saveSalmonRunInfo(start, end, stageName) {
  /* サーモンランの開始時刻、終了時刻、ステージ名 */
  var sheet = getSheet();
  sheet.getRange(1, SalmonRunSheet.START).setValue(start);
  sheet.getRange(1, SalmonRunSheet.END).setValue(end);
  sheet.getRange(1, SalmonRunSheet.STAGENAME).setValue(stageName);
}

/* サーモンランの通知を行ったかどうかを更新する.TRUE/FALSE */
function updateDoNotifyStatus(notifyStatus) {
  var sheet = getSheet();
  sheet.getRange(1, SalmonRunSheet.STATUS).setValue(notifyStatus);
}

/* サーモンランの情報をシートから取得する */
function loadSalmonRunInfo() {
  /* サーモンランの開始時刻、終了時刻、ステージ名を取得 */
  var salmonRunInfo = {}
  var data = getSheet().getDataRange().getValues();
  salmonRunInfo.start = data[0][0];
  salmonRunInfo.end = data[0][1];
  salmonRunInfo.stageName = data[0][2];
  salmonRunInfo.status = data[0][3];
  return salmonRunInfo;
}

function getKanketsusenImages(stageName) {
  var images = {}
  if(stageName == "シェケナダム") {
    images.normal = ImgUrl.SYEKENA_NORMAL;
    images.michi = ImgUrl.SYEKENA_MICHI;
  } else if (stageName == "海上集落シャケト場") {
    images.normal = ImgUrl.SAKETOBA_NORMAL;
    images.michi = ImgUrl.SAKETOBA_MICHI;
  } else if (stageName == "難破船ドン・ブラコ") {
    images.normal = ImgUrl.DONBURAKO_NORMAL;
    images.michi = ImgUrl.DONBURAKO_MICHI;
  } else if (stageName == "トキシラズいぶし工房") {
    images.normal = ImgUrl.TOKI_NORMAL;
    images.michi = ImgUrl.TOKI_MICHI;
  } else {
    images.normal = ImgUrl.DUMMY;
    images.normal = ImgUrl.DUMMY;
  }

  return images;
}

function notifyKanketsusen() {
  var info = loadSalmonRunInfo();
  var images = getKanketsusenImages(info.stageName);
  var msg = createMessage(info);
  var attachments = createAttachements(images);
  notify2Slack(msg, attachments);
}

function createMessage(info) {
  var msg = "【" + info.stageName + "】\n" + createSpanMessage(info.start, info.end);
  return msg;
}

function createSpanMessage(start, end) {
  var startMsg = createDateMessage(start);
  var endMsg = createDateMessage(end);

  return startMsg + " ~ " + endMsg;

}

function createDateMessage(momentStr) {
  var moment = Moment.moment(momentStr);
  var day = createDay(moment.day());
  return moment.format('YYYY/MM/DD') + "(" + day + ")" + moment.format('HH:mm');
}

function createDay(intDay) {
  switch(intDay) {
    case 0:
      return "日";
    case 1:
      return "月";
    case 2:
      return "火";
    case 3:
      return "水";
    case 4:
      return "木";
    case 5:
      return "金";
    case 6:
      return "土";
    default:
      return "？";
  }
}

function createAttachements(images) {
  var attachements = '[{ "color" : "#36a64f", "title": "通常", "image_url" : "' + images.normal + '"},{ "color" : "#3AA3E3", "title": "満潮", "image_url" : "' + images.michi + '"} ]';
  return attachements;
}

function notify2Slack(msg, attachments) {
  var slackApp = SlackApp.create(Const.token);
  slackApp.postMessage(Const.channelId, msg, {
    username : "カンケツセン通知BOT",
    icon_emoji : ":sake_fish:",
    attachments : attachments
  });
}

function getSheet() {
  if (getSheet.instance) { return getSheet.instance; }
  var sheet = SpreadsheetApp.openById(Const.spreadSheetId).getSheetByName(Const.sheetName);
  return sheet;
}
