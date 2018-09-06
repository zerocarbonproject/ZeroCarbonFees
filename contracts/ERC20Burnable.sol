pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";

/**
 * @title BurnableToken
 * 
 * Interface for Basic ERC20 interactions and allowing burning  of tokens
 *
 * (c) Philip Louw / Zero Carbon Project 2018. The MIT Licence.
 */
contract ERC20Burnable is ERC20Basic {

    function burn(uint256 _value) public;
}