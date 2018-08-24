pragma solidity ^0.4.23;

import "../PeriodUtil.sol";

/**
 * @title PeriodUtilMock
 * 
 * Used for testing the EnergisFees Contract, reduce the unit duration
 *
 * Time Unit is seconds
 * 
 *
 * (c) Philip Louw / Zero Carbon Project 2018. The MIT Licence.
 */
contract PeriodUtilMock is PeriodUtil {
  
    // High level each week is 10 seconds
    uint256 public constant SECONDS_PER_WEEK = 10;  
    // High level each year is 10 seconds (Units) * 5 (Units per Period) = 50 seconds
    uint256 public constant WEEKS_PER_PERIOD = 5;

    /**
    * @dev calculates the index for the given timestamp
    * @return Index count since EPOCH
    * @param timestamp The time in seconds since EPOCH (blocktime)
    */
    function getPeriodIdx(uint256 timestamp) public pure returns (uint256) {
        return timestamp / SECONDS_PER_WEEK;
    }

    /**
    * @dev Timestamp of the Period start
    * @return Time in seconds since EPOCH of the Period Start
    * @param periodIdx Period Index to find the start timestamp of
    */
    function getPeriodStartTimestamp(uint256 periodIdx) public pure returns (uint256) {
        return SECONDS_PER_WEEK * periodIdx;
    }

    /**
    * @dev Returns the Cycle count of the given Periods. A set of time creates a cycle, eg. If period is weeks the cycle can be years.
    * @return The Cycle Index
    * @param timestamp The time in seconds since EPOCH (blocktime)
    */
    function getPeriodCycle(uint256 timestamp) public pure returns (uint256) {
        return getPeriodIdx(timestamp) / WEEKS_PER_PERIOD;
    }

    /**
    * @dev Amount of Tokens per time unit since the start of the given periodIdx
    * @return Tokens per Time Unit from the given periodIdx start till now
    * @param tokens Total amount of tokens from periodIdx start till now (blocktime)
    * @param periodIdx Period IDX to use for time start
    */
    function getRatePerTimeUnits(uint256 tokens, uint256 periodIdx) public view returns (uint256) {
        if (tokens <= 0)
          return 0;
        uint256 secSinceTime = secondsSinceTimestamp(getPeriodStartTimestamp(periodIdx));
        return tokens / secSinceTime;
    }

    /**
    * @dev Hours since given timestamp
    * @param timestamp Timestamp in seconds since EPOCH to calculate hours to
    * @return Retuns the number of hours since the given timestamp and blocktime
    */
    function secondsSinceTimestamp(uint256 timestamp) public view returns (uint256) {
        assert(now > timestamp);
        return (now - timestamp);
    }

    /**
    * @dev Amount of time units in each Period, for exampe if units is hour and period is week it will be 3600
    * @return Amount of time units per period
    */
    function getUnitsPerPeriod() public pure returns (uint256) {
        return SECONDS_PER_WEEK;
    }
}