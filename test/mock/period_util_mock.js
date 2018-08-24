import expectThrow from '../helpers/expectThrow';

const PeriodUtilMock = artifacts.require("./mocks/PeriodUtilMock.sol");
const BigNumber = web3.BigNumber;

contract('PeriodUtilMock', function(accounts) {

  describe('Test getPeriodIdx (Mock)', async function() {

    const SECONDS_PER_PERIOD = 10;  
    const PERIODS_PER_PERIOD_CYCLE = 5;

    beforeEach(async function () {
      this.periodUtil = await PeriodUtilMock.new();
    });

    it('Config', async function() {
      var unitsPerPeriod = await this.periodUtil.getUnitsPerPeriod();
      assert.isTrue(new BigNumber(SECONDS_PER_PERIOD).eq(unitsPerPeriod));
    });

    it('Week Rnd', async function() {
      var weekIdx = await this.periodUtil.getPeriodIdx(new BigNumber('10'));
      assert.isTrue(new BigNumber(1).eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodIdx(new BigNumber('0'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));
      
      weekIdx = await this.periodUtil.getPeriodIdx(new BigNumber('9'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodIdx(new BigNumber('24'));
      assert.isTrue(new BigNumber(2).eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodIdx(new BigNumber('2563'));
      assert.isTrue(new BigNumber(256).eq(weekIdx));
    });
  });

  describe('Test getPeriodStartTimestamp (Mock)', async function() {

    beforeEach(async function () {
      this.periodUtil = await PeriodUtilMock.new();
    });

    it('Week Start', async function() {
      var weekIdx = await this.periodUtil.getPeriodStartTimestamp(new BigNumber('2527'));
      assert.isTrue(new BigNumber('25270').eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodStartTimestamp(new BigNumber('0'));
      assert.isTrue(new BigNumber(0).eq(weekIdx));
      
      weekIdx = await this.periodUtil.getPeriodStartTimestamp(new BigNumber(1));
      assert.isTrue(new BigNumber('10').eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodStartTimestamp(new BigNumber(2));
      assert.isTrue(new BigNumber('20').eq(weekIdx));

      weekIdx = await this.periodUtil.getPeriodStartTimestamp(new BigNumber(3));
      assert.isTrue(new BigNumber('30').eq(weekIdx));
    });
  });

  describe('Test getPeriodCycle (Mock)', async function() {

    beforeEach(async function () {
      this.periodUtil = await PeriodUtilMock.new();
    });
    

    it('Year Starts', async function() {
      var yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('31536000'));
      assert.isTrue(new BigNumber(630720).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('2145916800'));
      assert.isTrue(new BigNumber(42918336).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('1514764800'));
      assert.isTrue(new BigNumber(30295296).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('1483228800'));
      assert.isTrue(new BigNumber(29664576).eq(yearVal));
    });
    
    it('Year Ends', async function() {
      var yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('31535999'));
      assert.isTrue(new BigNumber(630719).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('2145916799'));
      assert.isTrue(new BigNumber(42918335).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('1514764799'));
      assert.isTrue(new BigNumber(30295295).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('1483228799'));
      assert.isTrue(new BigNumber(29664575).eq(yearVal));
    });

    it('Year Rnd Test', async function() {
      var yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('1528273397'));
      assert.isTrue(new BigNumber(30565467).eq(yearVal));

      yearVal = await this.periodUtil.getPeriodCycle(new BigNumber('13583252998'));
      assert.isTrue(new BigNumber(271665059).eq(yearVal));
    });
  });
});
