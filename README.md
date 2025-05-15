# QuasarStream WebRTC Signaling Library

[![License](https://img.shields.io/badge/license-BSD%203--Clause-blue.svg)](LICENSE)

A lightweight and efficient WebRTC signaling library written in **TypeScript**, using **WebSocket** and **Protocol Buffers** to exchange SDP (Session Description Protocol) messages. Designed for high-performance and seamless WebRTC integration.

---

## Features

-  Compatible with [PHP RTC-Signaling](https://github.com/PHP-WebRTC/signaling)
-  WebSocket-based signaling
-  Protocol Buffers for efficient binary message encoding
-  Supports offer/answer SDP exchange
-  Simple TypeScript API
-  BSD 3-Clause License

---

## Installation

```bash
npm install 
```

## Usage
```javascript
import { RTCSignaling } from '';

const signaling = new RTCSignaling();

signaling.request(peerConnection.localDescription).then((answer) =>
  peerConnection.setRemoteDescription(answer)
);
```

## Documentation

This package is part of the PHP WebRTC library. For complete documentation, examples, and API reference, visit:

[PHP WebRTC Documentation](https://www.quasarstream.com/php-webrtc)

## Credits

### Authors

- **Amin Yazdanpanah**
  - Website: [aminyazdanpanah.com](https://www.aminyazdanpanah.com)
  - Email: [github@aminyazdanpanah.com](mailto:github@aminyazdanpanah.com)

- **Sana Moniri**
  - GtiHub: [sanamoniri](https://github.com/sanamoniri)

## Reporting Issues

Found a bug? Please report it on our [issues](https://github.com/php-webrtc/signaling-js-sdk/issues).

## License

BSD 3-Clause License. See [LICENSE](LICENSE) for details.