/**
 * LSP Server Worker - Simplified Bridge
 */

/// <reference lib="webworker" />

let port: MessagePort;

self.onmessage = (event: MessageEvent) => {
  if (event.data?.type === 'init' && event.data?.port) {
    port = event.data.port;
    setupLSPBridge();
  }
};

function setupLSPBridge() {
  if (!port) return;

  port.onmessage = async (event: MessageEvent) => {
    const request = event.data;
    
    let response;
    switch (request.method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { resolveProvider: true },
              hoverProvider: true
            }
          }
        };
        break;
      default:
        response = {
          jsonrpc: '2.0', 
          id: request.id,
          result: null
        };
    }
    
    port.postMessage(response);
  };

  port.start();
}
