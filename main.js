const Stock = new stockGame;

function response(room, msg, sender) {
    if(msg.startsWith('/주식 ')) {
        let cmd = msg.slice(4).split('#');
        switch(cmd[0]) {
            case '가입':
                Api.replyRoom(room, Stock.createAccount(sender));
                break;
            case '매수':
                Stock.isUserNew(sender) ? Api.replyRoom(room, Stock.gameMessage[2]) : Api.replyRoom(room, Stock.buy(sender, cmd[1], cmd[2]));
                break;
            case '매도':
                Stock.isUserNew(sender) ? Api.replyRoom(room, Stock.gameMessage[2]) : Api.replyRoom(room, Stock.sell(sender, cmd[1], cmd[2]));
                break;
            case '잔고':
                Stock.isUserNew(sender) ? Api.replyRoom(room, Stock.gameMessage[2]) : Api.replyRoom(room, Stock,myInfo(sender));
                break;
            case '종목':
                Api.replyRoom(room, Stock.stockList());
                break;
            case '순위':
                Api.replyRoom(room, Stock.userRank());
                break;
        }
    }
    Stock.changePrice();
}

function stockGame() {
    this.dataFilePath = 'sdcard/stockGame/stockData.json'; // 파일 경로
    this.gameSetting = {
        newUserGift: 1000000, // 신규 유저 가입 선물 (1,000,000원)
        default_fluctuation_limit: 2, // 주식 가격 변동 Default 값 (1틱 최대 2%)
        minimum_tick_period: 60  // 가격 변동 최소 시간 (최소 60초)
    }, this.timestamp = null;
    this.gameMessage = [
        '가입 완료했습니다.', 
        '이미 가입했습니다.', 
        '가입 먼저 해주세요.', 
        '매매하려는 종목을 찾을 수 없습니다.', 
        '자연수만 입력해주세요.',
        '주문 가능 물량을 초과했습니다.\n주문 가능 수량: ',
        '매도 가능 물량을 초과했습니다.\n매도 가능 수량: ',
        '매도 가능 물량이 없습니다.',
        '상장 폐지된 주식은 매매 할 수 없습니다.'
    ];
}

stockGame.prototype.createAccount = function(userName) {
    if(this.isUserNew(userName)) {
        let data = this.fs(this.dataFilePath);        
        data.userList[userName] = {}; 
        data.userList[userName].balance = this.gameSetting.newUserGift;
        data.userList[userName].gift = this.gameSetting.newUserGift;
        data.userList[userName].stock = {};
        Object.keys(data.stockList).map(e => data.userList[userName].stock[e] = 0);
        this.fs(this.dataFilePath, data);
        return this.gameMessage[0];
    } else return this.gameMessage[1];
}, stockGame.prototype.isInt = function(n) {
    if(/^(\-|\+)?([0-9]+)$/.test(n) && parseInt(n) > 0) return true;
}, stockGame.prototype.isUserNew = function(userName) {
    return !this.fs(this.dataFilePath).userList[userName] ? true : false;
}, stockGame.prototype.plusMinus = function() {
    return Math.random() > .5 ? 1 : -1;
}, stockGame.prototype.comma = function(int) {
    return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}, stockGame.prototype.percent = function(t, e) {
    return ((t - e) / e * 100).toFixed(2) + '%';
}, stockGame.prototype.fs = function(path, data) {
    if(!data) return JSON.parse(FileStream.read(path));
    return FileStream.write(path, JSON.stringify(data, null, 4));
}, stockGame.prototype.changePrice = function() {
    let timestamp = Date.now() / 1000 | 0;
    if(!this.timestamp) this.timestamp = timestamp;
    if(timestamp - this.timestamp >= this.gameSetting.minimum_tick_period) {
        let data = this.fs(this.dataFilePath);
        Object.keys(data.stockList).map(e => data.stockList[e].current_price = this.fluctuation(e));
        this.timestamp = timestamp;
        this.fs(this.dataFilePath, data);
    }
}, stockGame.prototype.fluctuation = function(stock) {
    let data = this.fs(this.dataFilePath), limit = data.stockList[stock].fluctuation_limit;
    if(limit === 'Default') limit = this.gameSetting.default_fluctuation_limit;
    let price = data.stockList[stock].current_price + (Math.random() * data.stockList[stock].current_price * limit / 100 | 0) * this.plusMinus();
    return price <= 0 ? 0 : price;
}, stockGame.prototype.stockList = function() {
    let list = [], data = this.fs(this.dataFilePath);
    Object.keys(data.stockList).map(e => list.push(e + ' | ' + 
    this.percent(data.stockList[e].current_price, data.stockList[e].original_price) + '\n현재가: ' + 
    this.comma(data.stockList[e].current_price)));
    return '[주식 종목]\n\n' + list.join('\n\n');
}, stockGame.prototype.buy = function(userName, stockName, value) {
    let data = this.fs(this.dataFilePath);
    if(!data.stockList[stockName]) return this.gameMessage[3];
    if(data.stockList[stockName].current_price === 0) return this.gameMessage[8];
    if(this.isInt(value)) {
        let orderPrice = data.stockList[stockName].current_price * value;
        let remainBalance = data.userList[userName].balance - orderPrice;
        if(remainBalance < 0) return this.gameMessage[5] + data.userList[userName].balance / data.stockList[stockName].current_price | 0;
        if(!data.userList[userName].stock[stockName]) data.userList[userName].stock[stockName] = 0;
        data.userList[userName].balance = remainBalance;
        data.userList[userName].stock[stockName] = data.userList[userName].stock[stockName] + value;
        this.fs(this.dataFilePath, data);
        return '[주문 체결]\n\n종목: ' + stockName + '\n매수 가격: ' + this.comma(data.stockList[stockName].current_price) + '₩\n수량: ' + 
        value + '\n\n종합: -' + this.comma(orderPrice) + '₩';
    } else return this.gameMessage[4];
}, stockGame.prototype.sell = function(userName, stockName, value) {
    let data = this.fs(this.dataFilePath);
    if(!data.stockList[stockName]) return this.gameMessage[3];
    if(data.stockList[stockName].current_price === 0) return this.gameMessage[8];
    if(this.isInt(value)) {
        let orderPrice = data.stockList[stockName].current_price * value;
        let remainBalance = data.userList[userName].balance + orderPrice;
        if(!data.userList[userName].stock[stockName] || data.userList[userName].stock[stockName] === 0) return this.gameMessage[7];
        if(data.userList[userName].stock[stockName] - value < 0) return this.gameMessage[6] + data.userList[userName].stock[stockName];
        data.userList[userName].balance = remainBalance;
        data.userList[userName].stock[stockName] = data.userList[userName].stock[stockName] - value;
        this.fs(this.dataFilePath, data);
        return '[주문 체결]\n\n종목: ' + stockName + '\n매도 가격: ' + this.comma(data.stockList[stockName].current_price) + '₩\n수량: ' + 
        value + '\n\n종합: +' + this.comma(orderPrice) + '₩';
    } else return this.gameMessage[4];
}, stockGame.prototype.expectedBalance = function(data, userName) {
    let balance = data.userList[userName].balance;
    Object.keys(data.userList[userName].stock).map(e => balance += data.stockList[e].current_price * data.userList[userName].stock[e]);
    return balance;
}, stockGame.prototype.userRank = function() {
    let list = [], data = this.fs(this.dataFilePath);
    Object.keys(data.userList).map(e => list.push({
        user: e, balance: this.expectedBalance(data, e)
    })), list.sort((t, e) => e.balance - t.balance);
    for(let e in list) list[e] = Number(e) + 1 + '위 | ' + list[e].user + '\n총평가금액: ' + 
    this.comma(list[e].balance) + '₩\n예상수익률: ' + this.percent(list[e].balance, data.userList[list[e].user].gift);
    return '[주식 순위]\n\n' + list.join('\n\n');
}, stockGame.prototype.myInfo = function(userName) {
    let list = [], data = this.fs(this.dataFilePath);
    Object.keys(data.userList[userName].stock).map(e => list.push(e + ' | ' + data.userList[userName].stock[e] + '주'));
    return '[내 주식 잔고]\n\n닉네임: ' + userName + '\n보유 자산: ' + this.comma(data.userList[userName].balance) + '₩\n총평가금액: ' + 
    this.comma(this.expectedBalance(data, userName)) + '₩\n\n-보유 주식-\n' + list.join('\n');
};
