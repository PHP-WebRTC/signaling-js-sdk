/**
 * This file is part of the PHP WebRTC package.
 *
 * (c) Amin Yazdanpanah <github@aminyazdanpanah.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RTCSignaling } from './RTCSignaling';

export { RTCSignaling };

if (typeof window !== 'undefined') {
    window.RTCSignaling = RTCSignaling;
}

declare global {
    interface Window {
        RTCSignaling: typeof RTCSignaling;
    }
}