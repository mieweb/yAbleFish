/**
 * LSP Client - Real Language Server Protocol Integration
 * 
 * This creates a simplified LSP client that communicates directly with
 * the yAbelFish LSP server using a more direct approach.
 */

import * as monaco from 'monaco-editor';

export class YAbelLSPClient {
  private worker: Worker | null = null;
  private messageChannel: MessageChannel | null = null;

  /**
   * Start the LSP client
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Starting yAbelFish LSP Client...');

      // Create message channel for communication
      this.messageChannel = new MessageChannel();

      // Create worker that hosts the real LSP server
      this.worker = new Worker(
        new URL('./lsp-server-worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Send port to worker
      this.worker.postMessage({ 
        type: 'init', 
        port: this.messageChannel.port1 
      }, [this.messageChannel.port1]);

      // Set up message handling
      this.setupMessageHandling();

      console.log('✅ yAbelFish LSP Client started successfully');

    } catch (error) {
      console.error('❌ Failed to start LSP client:', error);
      throw error;
    }
  }

  /**
   * Stop the LSP client
   */
  async stop(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.messageChannel) {
      this.messageChannel.port2.close();
      this.messageChannel = null;
    }
  }

  /**
   * Send LSP request to server
   */
  async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.messageChannel) {
        reject(new Error('LSP client not started'));
        return;
      }

      const id = Math.random().toString(36);
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      // Set up response handler
      const handler = (event: MessageEvent) => {
        const response = event.data;
        if (response.id === id) {
          this.messageChannel!.port2.removeEventListener('message', handler);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };

      this.messageChannel.port2.addEventListener('message', handler);
      this.messageChannel.port2.postMessage(message);
    });
  }

  /**
   * Set up message handling between client and server
   */
  private setupMessageHandling(): void {
    if (!this.messageChannel) return;

    this.messageChannel.port2.onmessage = (event) => {
      const message = event.data;
      console.log('📨 Received from LSP server:', message);
    };

    this.messageChannel.port2.start();
  }

  /**
   * Register yAbel language with Monaco
   */
  static registerLanguage(): void {
    // Register yAbel language
    monaco.languages.register({
      id: 'yabel',
      extensions: ['.yabel', '.yaml'],
      aliases: ['yAbel', 'yabel'],
      mimetypes: ['text/x-yabel', 'application/x-yabel']
    });

    // Basic tokenization (can be enhanced later)
    monaco.languages.setMonarchTokensProvider('yabel', {
      tokenizer: {
        root: [
          [/^##\s+.*$/, 'section-header'],
          [/^[A-Za-z][^:]*:/, 'field-name'],
          [/\b[A-Z]\d{2}(\.\d+)?\b/, 'icd-code'],
          [/\b\d{4,}\b/, 'rxnorm-code'],
          [/#.*$/, 'comment']
        ]
      }
    });

    // Define theme
    monaco.editor.defineTheme('yabel-theme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'section-header', foreground: '0066cc', fontStyle: 'bold' },
        { token: 'field-name', foreground: '008000', fontStyle: 'bold' },
        { token: 'icd-code', foreground: '800080' },
        { token: 'rxnorm-code', foreground: 'ff6600' },
        { token: 'comment', foreground: '808080', fontStyle: 'italic' }
      ],
      colors: {}
    });
  }
}