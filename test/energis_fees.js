import expectThrow from './helpers/expectThrow';
import { doesNotReject } from 'assert';

const ZCFees = artifacts.require("./ZCFees.sol");
const PeriodUtilMock = artifacts.require("./mocks/PeriodUtilMock.sol");
const PeriodUtilNoCycleMock = artifacts.require("./mocks/PeriodUtilNoCycleMock.sol");
const TokenMock = artifacts.require("./mocks/TokenMock.sol");

const BigNumber = web3.BigNumber;

contract('ZCFees', function([_, ctcOwner, feesWallet, rewardWallet, supplier1, supplier2, supplier3]) {

    describe('Test Mock Construct', async function() {

        it('Invalid Grase Period', async function() {
          this.periodUtil = await PeriodUtilMock.new();
          this.token = await TokenMock.new(ctcOwner, 900000)
          await expectThrow(ZCFees.new(this.token.address, this.periodUtil.address, 11, feesWallet, rewardWallet, {from : ctcOwner}));
          await expectThrow(ZCFees.new(this.token.address, this.periodUtil.address, 10, feesWallet, rewardWallet, {from : ctcOwner}));
          await expectThrow(ZCFees.new(this.token.address, this.periodUtil.address, 0, feesWallet, rewardWallet, {from : ctcOwner}));
        });

        it('Contract should have a owner', async function() {
          this.periodUtil = await PeriodUtilMock.new();
          this.token = await TokenMock.new(ctcOwner, 900000);
          return ZCFees.new(this.token.address, this.periodUtil.address, 5, feesWallet, rewardWallet, {from : ctcOwner}).then(function(instance) {
            return instance.owner();
          }).then(function(owner) {
            assert.isTrue(owner !== 0, 'Owner is set');
          });
        });

        it('Contract creator should be owner', async function() {
            this.periodUtil = await PeriodUtilMock.new();
            this.token = await TokenMock.new(ctcOwner, 900000);
            return ZCFees.new(this.token.address, this.periodUtil.address, 5, feesWallet, rewardWallet, {from : ctcOwner}).then(function(instance) {
              return instance.owner();
            }).then(function(owner) {
              assert.isTrue(owner == ctcOwner, 'Owner is set to creator');
            });
          });
    });

    describe('Test On Time Processing (Single Processing)', async function() {

        const grasePeriod = 5;

        beforeEach(async function () {
          this.periodUtil = await PeriodUtilNoCycleMock.new();
          this.token = await TokenMock.new(ctcOwner, new BigNumber('100000000000000000000000000'));

          await this.token.transfer(supplier1, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier2, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier3, new BigNumber('24000000000000000000000000'), {from : ctcOwner});

          // Wait till within 1st sec of 10 time unit
          while ((new Date().getTime() / 1000) % 10 > 1) {
          }
          this.zcfees = await ZCFees.new(this.token.address, this.periodUtil.address, grasePeriod, feesWallet, rewardWallet, {from : ctcOwner});
        });

        it('Current Period must be last Period Exec', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
            var currPeriod = await this.zcfees.getWeekIdx();
            assert.isTrue(lastPeriodExecIdx == (currPeriod - 1), 'Initial Last Period Exec is pervious period');
            var weekProcessed = await this.zcfees.weekProcessed(lastPeriodExecIdx);
            assert.isTrue(weekProcessed, 'Should return true as processed');
        });

        it('Early Process Call', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('24000000000000000000000'), {from : supplier1});

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx), 'Period should not have incremented');
            var weekProcessed = await this.zcfees.weekProcessed(lastPeriodExecIdx.add(1));
            assert.isFalse(weekProcessed, 'Should return true as processed');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesCtcBal), 'Expected 24,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('0').eq(feesWalletBal), 'Expected 0 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('0 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');
            assert.isTrue(await this.zcfees.weekProcessed(periodIdx), 'Should return true as processed');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('0').eq(feesWalletBal), 'Expected 0 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('20,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('20000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('20000000000000000000000').eq(feesWalletBal), 'Expected 20,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('24,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('24000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesWalletBal), 'Expected 24,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('48,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('48000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesWalletBal), 'Expected 24,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(rewardBal), 'Expected 24,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('100,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('100000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('6000000000000000000000').eq(feesCtcBal), 'Expected 6,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesWalletBal), 'Expected 24,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('70000000000000000000000').eq(rewardBal), 'Expected 70,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('200,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('20000000000000000000000').eq(feesCtcBal), 'Expected 20,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('40000000000000000000000').eq(feesWalletBal), 'Expected 40,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('140000000000000000000000').eq(rewardBal), 'Expected 140,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('4,000,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('4000000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('400000000000000000000000').eq(feesCtcBal), 'Expected 400,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('800000000000000000000000').eq(feesWalletBal), 'Expected 800,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('2800000000000000000000000').eq(rewardBal), 'Expected 2,800,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('6,000,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('6000000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('800000000000000000000000').eq(feesCtcBal), 'Expected 800,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1000000000000000000000000').eq(feesWalletBal), 'Expected 1,000,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('4200000000000000000000000').eq(rewardBal), 'Expected 4,200,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('8,000,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('8000000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 400;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('1200000000000000000000000').eq(feesCtcBal), 'Expected 1,200,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1200000000000000000000000').eq(feesWalletBal), 'Expected 1,200,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('5600000000000000000000000').eq(rewardBal), 'Expected 5,600,000 Tokens in Reward Wallet, found ' + rewardBal);
        });
    });

// ***************************************************************************
// Test In Period, out of Grace Period Processing (Single Processing)
// ***************************************************************************

    describe('Test In Period, out of Grace Period Processing (Single Processing)', async function() {

        // 1 Second
        const grasePeriod = 1;

        beforeEach(async function () {
          this.periodUtil = await PeriodUtilNoCycleMock.new();
          this.token = await TokenMock.new(ctcOwner, new BigNumber('100000000000000000000000000'));

          await this.token.transfer(supplier1, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier2, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier3, new BigNumber('24000000000000000000000000'), {from : ctcOwner});

          // Wait till within 1st sec of 10 time unit
          while ((new Date().getTime() / 1000) % 10 > 1) {
          }
          this.zcfees = await ZCFees.new(this.token.address, this.periodUtil.address, grasePeriod, feesWallet, rewardWallet, {from : ctcOwner});
        });

        it('Current Period must be last Period Exec', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
            var currPeriod = await this.zcfees.getWeekIdx();
            assert.isTrue(lastPeriodExecIdx == (currPeriod - 1), 'Initial Last Period Exec is pervious period');
        });

        it('0 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Now wait 1 Second to be out of grace period
            var e = new Date().getTime() + 1000;
            while (new Date().getTime() <= e) {}

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('0').eq(feesWalletBal), 'Expected 0 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('24,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('24000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 200;
                while (new Date().getTime() <= e) {}
            }

            // Now wait 1 Second to be out of grace period
            var e = new Date().getTime() + 2000;
            while (new Date().getTime() <= e) {}

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('4000000000000000000000').eq(feesCtcBal), 'Expected 4,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('20000000000000000000000').eq(feesWalletBal), 'Expected 20,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('48,000 Funds Processing', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('48000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 200;
                while (new Date().getTime() <= e) {}
            }

            // Now wait 1 Second to be out of grace period
            var e = new Date().getTime() + 2000;
            while (new Date().getTime() <= e) {}

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('8000000000000000000000').eq(feesCtcBal), 'Expected 8,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesWalletBal), 'Expected 24,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('16000000000000000000000').eq(rewardBal), 'Expected 16,000 Tokens in Reward Wallet, found ' + rewardBal);
        });
    });

// ***************************************************************************
// Multiple Period Delayed Process
// ***************************************************************************

    describe('Multiple Period Delayed Process', async function() {

        // 1 Second
        const grasePeriod = 1;
    
        beforeEach(async function () {
            this.periodUtil = await PeriodUtilNoCycleMock.new();
            this.token = await TokenMock.new(ctcOwner, new BigNumber('100000000000000000000000000'));

            await this.token.transfer(supplier1, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
            await this.token.transfer(supplier2, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
            await this.token.transfer(supplier3, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
    
            // Wait till within 1st sec of 10 time unit
            while ((new Date().getTime() / 1000) % 10 < 1) {
            }
            this.zcfees = await ZCFees.new(this.token.address, this.periodUtil.address, grasePeriod, feesWallet, rewardWallet, {from : ctcOwner});
        });
    
        it('0 Funds Processing Delayed 2 Periods', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
    
            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
    
            // Now wait 1 Second to be out of grace period
            var e = new Date().getTime() + 1000;
            while (new Date().getTime() <= e) {}
    
            // Call the Process
            await this.zcfees.process({from : ctcOwner});
    
            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('0').eq(feesWalletBal), 'Expected 0 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('0').eq(rewardBal), 'Expected 0 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiDelay Test 01', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
    
            // Transfer 100,000
            await this.token.transfer(this.zcfees.address, new BigNumber('100000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Transfer 150,000
            await this.token.transfer(this.zcfees.address, new BigNumber('150000000000000000000000'), {from : supplier1});

            // Wait till next Period
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
        
            // Call the Process
            await this.zcfees.process({from : ctcOwner});
    
            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('25000000000000000000000').eq(feesCtcBal), 'Expected 25,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('50000000000000000000000').eq(feesWalletBal), 'Expected 50,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('175000000000000000000000').eq(rewardBal), 'Expected 175,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiDelay Test 02', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
            var periodIdx = await this.zcfees.getWeekIdx.call();

            // Period 1 : Transfer 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            assert.isTrue(periodIdx.eq((await this.zcfees.lastPeriodExecIdx.call()).add(1)), 'Should currently be next Period');
            assert.isTrue(lastPeriodExecIdx.add(1).eq((await this.zcfees.lastPeriodExecIdx.call())), 'Last Period Process should be period previous to current');
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('50000000000000000000000').eq(feesCtcBal), 'Expected 50,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 2 : No Process : Transfer 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('550000000000000000000000').eq(feesCtcBal), 'Expected 550,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : Transfer 300,000
            await this.token.transfer(this.zcfees.address, new BigNumber('300000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            await this.zcfees.process({from : ctcOwner});
            assert.isTrue(periodIdx.sub(1).eq((await this.zcfees.lastPeriodExecIdx.call())), 'Last Period Process should be previous to current period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('104750000000000000000000').eq(feesCtcBal), 'Expected 104,750 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('285250000000000000000000').eq(feesWalletBal), 'Expected 285,250 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('910000000000000000000000').eq(rewardBal), 'Expected 910,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiDelay Test 03', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();
            var periodIdx = await this.zcfees.getWeekIdx.call();

            // Period 1 : Transfer 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            assert.isTrue(periodIdx.eq((await this.zcfees.lastPeriodExecIdx.call()).add(1)), 'Should currently be next Period');
            assert.isTrue(lastPeriodExecIdx.add(1).eq((await this.zcfees.lastPeriodExecIdx.call())), 'Last Period Process should be period previous to current');
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('50000000000000000000000').eq(feesCtcBal), 'Expected 50,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 2 : No Process : Transfer 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('550000000000000000000000').eq(feesCtcBal), 'Expected 550,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : No Process : Transfer 300,000
            await this.token.transfer(this.zcfees.address, new BigNumber('300000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('850000000000000000000000').eq(feesCtcBal), 'Expected 850,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 4 : Transfer 100,000
            await this.token.transfer(this.zcfees.address, new BigNumber('100000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            await this.zcfees.process({from : ctcOwner});
            assert.isTrue(periodIdx.sub(1).eq((await this.zcfees.lastPeriodExecIdx.call())), 'Last Period Process should be previous to current period');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('49012500000000000000000').eq(feesCtcBal), 'Expected 49,012.5 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('370987500000000000000000').eq(feesWalletBal), 'Expected 370,987.5 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('980000000000000000000000').eq(rewardBal), 'Expected 980,000 Tokens in Reward Wallet, found ' + rewardBal);
        });
    });

// ***************************************************************************
// Multiple Period Process
// ***************************************************************************

    describe('Multiple Period Process', async function() {

        // 1 Second
        const grasePeriod = 1;

        beforeEach(async function () {
          this.periodUtil = await PeriodUtilNoCycleMock.new();
          this.token = await TokenMock.new(ctcOwner, new BigNumber('100000000000000000000000000'));

          await this.token.transfer(supplier1, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier2, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
          await this.token.transfer(supplier3, new BigNumber('24000000000000000000000000'), {from : ctcOwner});

          // Wait till within 1st sec of 10 time unit
          while ((new Date().getTime() / 1000) % 10 > 1) {
          }
          this.zcfees = await ZCFees.new(this.token.address, this.periodUtil.address, grasePeriod, feesWallet, rewardWallet, {from : ctcOwner});
        });

        it('MultiPeriod Test 01', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            await this.token.transfer(this.zcfees.address, new BigNumber('100000000000000000000000'), {from : supplier1});

            // Wait till next Period 1
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period 1');

            // Wait till next Period 2
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period 2');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('30000000000000000000000').eq(feesWalletBal), 'Expected 30,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('70000000000000000000000').eq(rewardBal), 'Expected 70,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiPeriod Test 02', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            // Send 150,000
            await this.token.transfer(this.zcfees.address, new BigNumber('150000000000000000000000'), {from : supplier1});

            // Wait till next Period 1
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period 1');

            // Send 110,000
            await this.token.transfer(this.zcfees.address, new BigNumber('110000000000000000000000'), {from : supplier1});

            // Wait till next Period 2
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period 2');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('19500000000000000000000').eq(feesCtcBal), 'Expected 19,500 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('58500000000000000000000').eq(feesWalletBal), 'Expected 58,500 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('182000000000000000000000').eq(rewardBal), 'Expected 182,000 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiPeriod Test 03', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            // Send 300,000
            await this.token.transfer(this.zcfees.address, new BigNumber('300000000000000000000000'), {from : supplier1});

            // Wait till next Period 1
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period 1');

            // Send 95,000
            await this.token.transfer(this.zcfees.address, new BigNumber('95000000000000000000000'), {from : supplier1});

            // Wait till next Period 2
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }

            // Call the Process
            await this.zcfees.process({from : ctcOwner});

            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period 2');

            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('1500000000000000000000').eq(feesCtcBal), 'Expected 1,500 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('117000000000000000000000').eq(feesWalletBal), 'Expected 117,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('276500000000000000000000').eq(rewardBal), 'Expected 276,500 Tokens in Reward Wallet, found ' + rewardBal);
        });

        it('MultiPeriod Test 04', async function() {
            var lastPeriodExecIdx = await this.zcfees.lastPeriodExecIdx.call();

            // Period 2 : Send 300,000
            await this.token.transfer(this.zcfees.address, new BigNumber('300000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(1)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            var periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(1)), 'Should currently be next Period 1');
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('30000000000000000000000').eq(feesCtcBal), 'Expected 30,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('60000000000000000000000').eq(feesWalletBal), 'Expected 60,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('210000000000000000000000').eq(rewardBal), 'Expected 210,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : Send 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(2)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(2)), 'Should currently be next Period 2');
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('33000000000000000000000').eq(feesCtcBal), 'Expected 33,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('117000000000000000000000').eq(feesWalletBal), 'Expected 117,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 4 : Send 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(3)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(3)), 'Should currently be next Period 3');
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('38850000000000000000000').eq(feesCtcBal), 'Expected 38,850 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('171150000000000000000000').eq(feesWalletBal), 'Expected 171,150 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('490000000000000000000000').eq(rewardBal), 'Expected 490,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 5 : Send 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(lastPeriodExecIdx.add(4)) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.lastPeriodExecIdx.call();
            assert.isTrue(periodIdx.eq(lastPeriodExecIdx.add(4)), 'Should currently be next Period 4');
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('47407500000000000000000').eq(feesCtcBal), 'Expected 47,407.5 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('222592500000000000000000').eq(feesWalletBal), 'Expected 222,592.5 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('630000000000000000000000').eq(rewardBal), 'Expected 630,000 Tokens in Reward Wallet, found ' + rewardBal);
        });
    });

// ***************************************************************************
// Test Period Cycle
// ***************************************************************************

    describe('Test Period Cycle', async function() {

        // 1 Second
        const grasePeriod = 1;
        // Total Supply of tokens
        const totalTokenSupply = new BigNumber('100000000000000000000000000');

        beforeEach(async function () {
            this.periodUtil = await PeriodUtilMock.new();
            this.token = await TokenMock.new(ctcOwner, totalTokenSupply);

            await this.token.transfer(supplier1, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
            await this.token.transfer(supplier2, new BigNumber('24000000000000000000000000'), {from : ctcOwner});
            await this.token.transfer(supplier3, new BigNumber('24000000000000000000000000'), {from : ctcOwner});

            // Wait till within 1st sec of 10 time unit and begining of Cycle
            while ((new Date().getTime() / 1000) % 50 > 1) {
            }
            this.zcfees = await ZCFees.new(this.token.address, this.periodUtil.address, grasePeriod, feesWallet, rewardWallet, {from : ctcOwner});
        });

        it('Basic cycle test', async function() {
            assert.isTrue((await this.token.totalSupply.call()).eq(totalTokenSupply));

            var startWeekIdx = await this.zcfees.getWeekIdx.call();
            var startYearIdx = await this.zcfees.getYearIdx.call();

            var periodIdx = await this.zcfees.getWeekIdx.call();
            var yearIdx = await this.zcfees.getYearIdx.call();

            // Period 1
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            var yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.eq(yearIdx), 'Expected year ' + startYearIdx + ', Found ' +  yearIdx);
            var periodIdx = await this.zcfees.getWeekIdx.call();

            // Period 2
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.eq(yearIdx), 'Expected year ' + startYearIdx + ', Found ' +  yearIdx);
            periodIdx = await this.zcfees.getWeekIdx.call();

            // Period 3
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.eq(yearIdx), 'Expected year ' + startYearIdx + ', Found ' +  yearIdx);
            periodIdx = await this.zcfees.getWeekIdx.call();

            // Period 4
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.eq(yearIdx), 'Expected year ' + startYearIdx + ', Found ' +  yearIdx);
            periodIdx = await this.zcfees.getWeekIdx.call();

            // New Year
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            var yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.add(1).eq(yearIdx), 'Expected year ' + startYearIdx.add(1) + ', Found ' +  yearIdx);
            var periodIdx = await this.zcfees.getWeekIdx.call();
        });

        it('PeriodCycle Test 01', async function() {
            assert.isTrue((await this.token.totalSupply.call()).eq(totalTokenSupply), 'Expected not tokens to be burned already!');

            var startWeekIdx = await this.zcfees.getWeekIdx.call();
            var startYearIdx = await this.zcfees.getYearIdx.call();

            var periodIdx = await this.zcfees.getWeekIdx.call();
            var yearIdx = await this.zcfees.getYearIdx.call();

            // Period 1 : 100,000
            await this.token.transfer(this.zcfees.address, new BigNumber('100000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            var periodIdx = await this.zcfees.getWeekIdx.call();
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('6000000000000000000000').eq(feesCtcBal), 'Expected 6,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('24000000000000000000000').eq(feesWalletBal), 'Expected 24,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('70000000000000000000000').eq(rewardBal), 'Expected 70,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 2 : 150,000
            await this.token.transfer(this.zcfees.address, new BigNumber('150000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('21000000000000000000000').eq(feesCtcBal), 'Expected 21,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('54000000000000000000000').eq(feesWalletBal), 'Expected 54,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('175000000000000000000000').eq(rewardBal), 'Expected 175,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : 300,000
            await this.token.transfer(this.zcfees.address, new BigNumber('300000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('51000000000000000000000').eq(feesCtcBal), 'Expected 51,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('114000000000000000000000').eq(feesWalletBal), 'Expected 114,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('385000000000000000000000').eq(rewardBal), 'Expected 385,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 4 : 125,600
            await this.token.transfer(this.zcfees.address, new BigNumber('125600000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('31680000000000000000000').eq(feesCtcBal), 'Expected 31,680 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('171000000000000000000000').eq(feesWalletBal), 'Expected 171,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('472920000000000000000000').eq(rewardBal), 'Expected 472,920 Tokens in Reward Wallet, found ' + rewardBal);

            // New Year
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            assert.isTrue(periodIdx.sub(1).eq(await this.zcfees.lastPeriodExecIdx.call()), 'Expected last Processed Period to be previous period');
            var yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.add(1).eq(yearIdx), 'Expected year ' + startYearIdx.add(1) + ', Found ' +  yearIdx);
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('253297500000000000000000').eq(feesWalletBal), 'Expected 253,297.5 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('612920000000000000000000').eq(rewardBal), 'Expected 612,920 Tokens in Reward Wallet, found ' + rewardBal);
            
            // Validate tokens where burned
            var totalTokens = await this.token.totalSupply.call();
            assert.isTrue(totalTokens.eq(totalTokenSupply.sub(new BigNumber('9382500000000000000000'))), 'Expected 9,382.5 to have been burned! Found ' + (totalTokenSupply.sub(totalTokens)));
        });

        it('PeriodCycle Test 02', async function() {
            var startWeekIdx = await this.zcfees.getWeekIdx.call();
            var startYearIdx = await this.zcfees.getYearIdx.call();

            var periodIdx = await this.zcfees.getWeekIdx.call();
            var yearIdx = await this.zcfees.getYearIdx.call();

            // Period 1 : 1,200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('1200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            var periodIdx = await this.zcfees.getWeekIdx.call();
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('120000000000000000000000').eq(feesCtcBal), 'Expected 120,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('240000000000000000000000').eq(feesWalletBal), 'Expected 240,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('840000000000000000000000').eq(rewardBal), 'Expected 840,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 2 : 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('42000000000000000000000').eq(feesCtcBal), 'Expected 42,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('468000000000000000000000').eq(feesWalletBal), 'Expected 468,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1190000000000000000000000').eq(rewardBal), 'Expected 1,190,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : 300,123
            await this.token.transfer(this.zcfees.address, new BigNumber('300123000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('684600000000000000000000').eq(feesWalletBal), 'Expected 684,600 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1315523000000000000000000').eq(rewardBal), 'Expected 1,315,523 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 4 : 125,600
            await this.token.transfer(this.zcfees.address, new BigNumber('125600000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('810200000000000000000000').eq(feesWalletBal), 'Expected 810,200 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1315523000000000000000000').eq(rewardBal), 'Expected 1,315,523 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 5 : 200,000 : New Year
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.add(1).eq(yearIdx), 'Expected year ' + startYearIdx.add(1) + ', Found ' +  yearIdx);
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('929520000000000000000000').eq(feesWalletBal), 'Expected 929,520 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1396203000000000000000000').eq(rewardBal), 'Expected 1,396,203 Tokens in Reward Wallet, found ' + rewardBal);
            var totalTokens = await this.token.totalSupply.call();
            assert.isTrue(totalTokens.eq(totalTokenSupply.sub(new BigNumber('0'))), 'Expected 0 to have been burned! Found ' + (totalTokenSupply.sub(totalTokens)));

            // Period 6 : 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1042874000000000000000000').eq(feesWalletBal), 'Expected 1,042,874 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1482849000000000000000000').eq(rewardBal), 'Expected 1,482,849 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 7 : 20,000
            await this.token.transfer(this.zcfees.address, new BigNumber('20000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1062874000000000000000000').eq(feesWalletBal), 'Expected 1,062,874 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1482849000000000000000000').eq(rewardBal), 'Expected 1,482,849 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 8 : 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('20000000000000000000000').eq(feesCtcBal), 'Expected 20,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1102874000000000000000000').eq(feesWalletBal), 'Expected 1,102,874 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1622849000000000000000000').eq(rewardBal), 'Expected 1,622,849 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 9 : 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('40000000000000000000000').eq(feesCtcBal), 'Expected 40,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1142874000000000000000000').eq(feesWalletBal), 'Expected 1,142,874 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1762849000000000000000000').eq(rewardBal), 'Expected 1,762,849 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 10 : 150,000 : New Year
            await this.token.transfer(this.zcfees.address, new BigNumber('150000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx.add(1)) < 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.add(2).eq(yearIdx), 'Expected year ' + startYearIdx.add(2) + ', Found ' +  yearIdx);
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('1216124000000000000000000').eq(feesWalletBal), 'Expected 1,216,124 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1867849000000000000000000').eq(rewardBal), 'Expected 1,867,849 Tokens in Reward Wallet, found ' + rewardBal);
            totalTokens = await this.token.totalSupply.call();
            assert.isTrue(totalTokens.eq(totalTokenSupply.sub(new BigNumber('11750000000000000000000'))), 'Expected 11,750 to have been burned! Found ' + (totalTokenSupply.sub(totalTokens)));
        });
        

        it('PeriodCycle Test 03', async function() {
            var startWeekIdx = await this.zcfees.getWeekIdx.call();
            var startYearIdx = await this.zcfees.getYearIdx.call();

            var periodIdx = await this.zcfees.getWeekIdx.call();
            var yearIdx = await this.zcfees.getYearIdx.call();

            // Period 1 : 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            var periodIdx = await this.zcfees.getWeekIdx.call();
            var feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('50000000000000000000000').eq(feesCtcBal), 'Expected 50,000 120,000 Tokens in Fees Contract, found ' + feesCtcBal);
            var feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesWalletBal), 'Expected 100,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            var rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('350000000000000000000000').eq(rewardBal), 'Expected 350,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 2 : 500,000
            await this.token.transfer(this.zcfees.address, new BigNumber('500000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('100000000000000000000000').eq(feesCtcBal), 'Expected 100,000 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('200000000000000000000000').eq(feesWalletBal), 'Expected 200,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('700000000000000000000000').eq(rewardBal), 'Expected 700,000 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 3 : 300,123
            await this.token.transfer(this.zcfees.address, new BigNumber('300123000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('95036900000000000000000').eq(feesCtcBal), 'Expected 92,036.9 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('295000000000000000000000').eq(feesWalletBal), 'Expected 295,000 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('910086100000000000000000').eq(rewardBal), 'Expected 910,086.1 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 4 : 125,600
            await this.token.transfer(this.zcfees.address, new BigNumber('125600000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('42466900000000000000000').eq(feesCtcBal), 'Expected 42,466.9 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('385250000000000000000000').eq(feesWalletBal), 'Expected 385,250 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('998006100000000000000000').eq(rewardBal), 'Expected 998,006.1 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 5 : 200,000 : New Year : No Process
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            periodIdx = await this.zcfees.getWeekIdx.call();
            yearIdx = await this.zcfees.getYearIdx.call();
            assert.isTrue(startYearIdx.add(1).eq(yearIdx), 'Expected year ' + startYearIdx.add(1) + ', Found ' +  yearIdx);

            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('242466900000000000000000').eq(feesCtcBal), 'Expected 242,466.9 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('385250000000000000000000').eq(feesWalletBal), 'Expected 385,250 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('998006100000000000000000').eq(rewardBal), 'Expected 998,006.1 Tokens in Reward Wallet, found ' + rewardBal);

            // Period 6 : 200,000
            await this.token.transfer(this.zcfees.address, new BigNumber('200000000000000000000000'), {from : supplier1});
            while ((await this.zcfees.getWeekIdx.call()).comparedTo(periodIdx) <= 0) {
                var e = new Date().getTime() + 250;
                while (new Date().getTime() <= e) {}
            }
            await this.zcfees.process({from : ctcOwner});
            periodIdx = await this.zcfees.getWeekIdx.call();
            feesCtcBal = await this.token.balanceOf(this.zcfees.address);
            assert.isTrue(new BigNumber('0').eq(feesCtcBal), 'Expected 0 Tokens in Fees Contract, found ' + feesCtcBal);
            feesWalletBal = await this.token.balanceOf(feesWallet);
            assert.isTrue(new BigNumber('564985175000000000000000').eq(feesWalletBal), 'Expected 564,985.175 Tokens in Fees Wallet, found ' + feesWalletBal);
            rewardBal = await this.token.balanceOf(rewardWallet);
            assert.isTrue(new BigNumber('1256555475000000000000000').eq(rewardBal), 'Expected 1,256,555.475 Tokens in Reward Wallet, found ' + rewardBal);
            var totalTokens = await this.token.totalSupply.call();
            assert.isTrue(totalTokens.eq(totalTokenSupply.sub(new BigNumber('4182350000000000000000'))), 'Expected 4,182.35 to have been burned! Found ' + (totalTokenSupply.sub(totalTokens)));
        });
    });
});
