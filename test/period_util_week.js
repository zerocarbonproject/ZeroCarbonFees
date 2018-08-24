import expectThrow from './helpers/expectThrow';

const PeriodUtilWeek = artifacts.require("./PeriodUtilWeek.sol");

const BigNumber = web3.BigNumber;

contract('PeriodUtilWeek',function(accounts) {

  describe('Test getPeriodIdx (Week)', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });

    it('Config', async function() {
      var unitsPerPeriod = await this.periodUtilWeek.getUnitsPerPeriod();
      assert.isTrue(new BigNumber(168).eq(unitsPerPeriod));

      
    });

    it('Week Rnd', async function() {
      var weekIdx = await this.periodUtilWeek.getPeriodIdx(new BigNumber('1528283999'));
      assert.isTrue(new BigNumber(2526).eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodIdx(new BigNumber('0'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));
      
      weekIdx = await this.periodUtilWeek.getPeriodIdx(new BigNumber('518400'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodIdx(new BigNumber('604800'));
      assert.isTrue(new BigNumber(1).eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodIdx(new BigNumber('1209600'));
      assert.isTrue(new BigNumber(2).eq(weekIdx));
    });

  });

  describe('Test getPeriodStartTimestamp (Week)', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });

    it('Week Start', async function() {
      var weekIdx = await this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber('2527'));
      assert.isTrue(new BigNumber('1528329600').eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber('0'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));
      
      weekIdx = await this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber(1));
      assert.isTrue(new BigNumber('604800').eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber(2));
      assert.isTrue(new BigNumber('1209600').eq(weekIdx));

      weekIdx = await this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber(3));
      assert.isTrue(new BigNumber('1814400').eq(weekIdx));
    });

    it('Limits', async function() {
      await expectThrow(this.periodUtilWeek.getPeriodStartTimestamp(new BigNumber('50000')));
    });
  });

  describe('Test getPeriodCycle (Year)', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });
    

    it('Year Starts', async function() {
      var yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('31536000'));
      assert.isTrue(new BigNumber(1971).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('2145916800'));
      assert.isTrue(new BigNumber(2038).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('1514764800'));
      assert.isTrue(new BigNumber(2018).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('1483228800'));
      assert.isTrue(new BigNumber(2017).eq(yearVal));
    });
    
    it('Year Ends', async function() {
      var yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('31535999'));
      assert.isTrue(new BigNumber(1970).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('2145916799'));
      assert.isTrue(new BigNumber(2037).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('1514764799'));
      assert.isTrue(new BigNumber(2017).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('1483228799'));
      assert.isTrue(new BigNumber(2016).eq(yearVal));
    });

    it('Year Rnd Test', async function() {
      var yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('1528273397'));
      assert.isTrue(new BigNumber(2018).eq(yearVal));

      yearVal = await this.periodUtilWeek.getPeriodCycle(new BigNumber('13583252998'));
      assert.isTrue(new BigNumber(2400).eq(yearVal));

      
    });
  });

  describe('Test isLeapYear', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });
    
    it('Leaps', async function() {
      var isLeap = await this.periodUtilWeek.isLeapYear(400);
      assert.isTrue(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(4000);
      assert.isTrue(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(1600);
      assert.isTrue(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2000);
      assert.isTrue(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2020);
      assert.isTrue(isLeap);
    });

    it('Not Leaps', async function() {
      var isLeap = await this.periodUtilWeek.isLeapYear(2003);
      assert.isFalse(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2009);
      assert.isFalse(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2018);
      assert.isFalse(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2019);
      assert.isFalse(isLeap);
      isLeap = await this.periodUtilWeek.isLeapYear(2045);
      assert.isFalse(isLeap);
    });
  });

  describe('Test hoursSinceTimestamp', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });
    
    it('Basics', async function() {
      var currTimeSec = new BigNumber(new Date().getTime() / 1000);

      var hoursSinceTime =  await this.periodUtilWeek.hoursSinceTimestamp(currTimeSec.sub(3600));
      assert.isTrue(new BigNumber(1).eq(hoursSinceTime), 'Expected 1 hour found ' + hoursSinceTime);

      var hoursSinceTime =  await this.periodUtilWeek.hoursSinceTimestamp(currTimeSec.sub(3600*3));
      assert.isTrue(new BigNumber(3).eq(hoursSinceTime), 'Expected 3 hour found ' + hoursSinceTime);
    });

    it('Exceptions', async function() {
      var currTimeSec = new BigNumber(new Date().getTime() / 1000);

      await expectThrow(this.periodUtilWeek.hoursSinceTimestamp(currTimeSec.add(3600)));
      await expectThrow(this.periodUtilWeek.hoursSinceTimestamp(currTimeSec.add(3600*4)));
    });
  });

  describe('Test getRatePerTimeUnits', async function() {

    beforeEach(async function () {
      this.periodUtilWeek = await PeriodUtilWeek.new();
    });
    
    it('Failover condition', async function() {
      var currTimeSec = new BigNumber(new Date().getTime() / 1000);

      var tokenRate =  await this.periodUtilWeek.getRatePerTimeUnits(new BigNumber('0'), 999);
      assert.isTrue(new BigNumber('0').eq(tokenRate),'Expected 0 token Rate, found ' + tokenRate);
    });

    it('Test 01', async function() {
      var currTimeSec = new BigNumber(new Date().getTime() / 1000);
      var weekIdx = await this.periodUtilWeek.getPeriodIdx.call(currTimeSec);
      var periodStartTimeStamp = await this.periodUtilWeek.getPeriodStartTimestamp(weekIdx);
      var hoursSinceTimeStamp = new BigNumber(currTimeSec).sub(new BigNumber(periodStartTimeStamp)).div(new BigNumber(3600));

      var tokenRate =  await this.periodUtilWeek.getRatePerTimeUnits(hoursSinceTimeStamp, weekIdx);
      assert.isTrue(new BigNumber('1').eq(tokenRate),'Expected 1 token Rate, found ' + tokenRate);
    });

    it('Test 02', async function() {
      var currTimeSec = new BigNumber(new Date().getTime() / 1000);
      var weekIdx = await this.periodUtilWeek.getPeriodIdx.call(currTimeSec);
      var periodStartTimeStamp = await this.periodUtilWeek.getPeriodStartTimestamp(weekIdx);
      var hoursSinceTimeStamp = new BigNumber(currTimeSec).sub(new BigNumber(periodStartTimeStamp)).div(new BigNumber(3600)).mul(new BigNumber('3'));

      var tokenRate =  await this.periodUtilWeek.getRatePerTimeUnits(hoursSinceTimeStamp, weekIdx);
      assert.isTrue(new BigNumber('3').eq(tokenRate),'Expected 3 token Rate, found ' + tokenRate);
    });
  });
});
