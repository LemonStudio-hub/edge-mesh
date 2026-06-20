import { ref, onUnmounted } from 'vue';
import { ICE_CONFIG, DATA_CHANNEL_LABEL } from '@edge-mesh/shared';
import type { SignalMessage } from '@edge-mesh/shared';

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface WebRTCOptions {
  /** If false, skip auto-disconnect on unmount. Default: true */
  autoCleanup?: boolean;
}

export function useWebRTC(
  signalingSend: (msg: SignalMessage) => void,
  onMessage: (handler: (msg: SignalMessage) => void) => (() => void),
  options: WebRTCOptions = {}
) {
  const { autoCleanup = true } = options;
  const connectionState = ref<ConnectionState>('new');
  const dataChannel = ref<RTCDataChannel | null>(null);
  const remotePeerId = ref('');

  let pc: RTCPeerConnection | null = null;
  const dataChannelHandlers: ((dc: RTCDataChannel) => void)[] = [];
  const messageHandlers: ((event: MessageEvent) => void)[] = [];

  let removeSignalingHandler: (() => void) | null = null;

  function createPeerConnection() {
    pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && remotePeerId.value) {
        signalingSend({
          type: 'ice-candidate',
          from: '',
          to: remotePeerId.value,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      connectionState.value = (pc?.connectionState as ConnectionState) || 'disconnected';
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    connectionState.value = 'connecting';
  }

  function setupDataChannel(channel: RTCDataChannel) {
    dataChannel.value = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      connectionState.value = 'connected';
      for (const handler of dataChannelHandlers) {
        handler(channel);
      }
    };

    channel.onclose = () => {
      connectionState.value = 'disconnected';
    };

    channel.onmessage = (event) => {
      for (const handler of messageHandlers) {
        handler(event);
      }
    };
  }

  /** Initiate a connection as the caller */
  async function connect(targetPeerId: string) {
    remotePeerId.value = targetPeerId;
    createPeerConnection();

    // Create data channel as the initiator
    const channel = pc!.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    setupDataChannel(channel);

    // Create offer
    const offer = await pc!.createOffer();
    await pc!.setLocalDescription(offer);

    signalingSend({
      type: 'offer',
      from: '',
      to: targetPeerId,
      sdp: offer,
    });

    // Listen for answer and ICE candidates
    removeSignalingHandler = onMessage(async (msg) => {
      if (!pc) return;

      if (msg.type === 'answer' && 'sdp' in msg) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === 'ice-candidate' && 'candidate' in msg) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {
          // Ignore ICE errors
        }
      }
    });
  }

  /** Accept a connection as the callee */
  async function accept(offerSdp: RTCSessionDescriptionInit, fromPeerId: string) {
    remotePeerId.value = fromPeerId;
    createPeerConnection();

    await pc!.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await pc!.createAnswer();
    await pc!.setLocalDescription(answer);

    signalingSend({
      type: 'answer',
      from: '',
      to: fromPeerId,
      sdp: answer,
    });

    // Listen for ICE candidates
    removeSignalingHandler = onMessage(async (msg) => {
      if (!pc) return;
      if (msg.type === 'ice-candidate' && 'candidate' in msg) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {
          // Ignore ICE errors
        }
      }
    });
  }

  function onDataChannel(handler: (dc: RTCDataChannel) => void) {
    dataChannelHandlers.push(handler);
    return () => {
      const idx = dataChannelHandlers.indexOf(handler);
      if (idx >= 0) dataChannelHandlers.splice(idx, 1);
    };
  }

  function onData(handler: (event: MessageEvent) => void) {
    messageHandlers.push(handler);
    return () => {
      const idx = messageHandlers.indexOf(handler);
      if (idx >= 0) messageHandlers.splice(idx, 1);
    };
  }

  function disconnect() {
    if (removeSignalingHandler) {
      removeSignalingHandler();
      removeSignalingHandler = null;
    }
    dataChannel.value?.close();
    dataChannel.value = null;
    pc?.close();
    pc = null;
    connectionState.value = 'disconnected';
    remotePeerId.value = '';
  }

  if (autoCleanup) {
    onUnmounted(() => {
      disconnect();
    });
  }

  return {
    connectionState,
    dataChannel,
    remotePeerId,
    connect,
    accept,
    onDataChannel,
    onData,
    disconnect,
  };
}
