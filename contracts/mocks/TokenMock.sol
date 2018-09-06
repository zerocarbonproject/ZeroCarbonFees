pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";

contract TokenMock is BurnableToken {

    constructor (address initialAccount, uint256 initialBalance) public {
        balances[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
    }
}