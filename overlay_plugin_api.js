// 这是一个简单的 OverlayPlugin API 包装器
// 修复了 "Missing Parameters" 错误: 某些版本的 OverlayPlugin 需要传递回调函数

(function () {
    var overlayWindowId = undefined;

    window.addOverlayListener = function (event, cb) {
        if (overlayWindowId) {
            window.callOverlayHandler({ call: 'subscribe', events: [event] });
        }
        document.addEventListener('onOverlayStateUpdate', function (e) {
            if (!e.detail.isLocked) {
                document.documentElement.classList.add('resize-handle');
            } else {
                document.documentElement.classList.remove('resize-handle');
            }
        });

        // 绑定事件到 document
        document.addEventListener(event, function (e) {
            cb(e.detail);
        });
    };

    window.removeOverlayListener = function (event, cb) {
        // OverlayPlugin 不直接支持移除特定 callback 的 listener
    };

    window.callOverlayHandler = function (msg) {
        return new Promise((resolve, reject) => {
            if (window.OverlayPluginApi && window.OverlayPluginApi.callHandler) {
                try {
                    // 尝试传递回调函数作为第二个参数
                    // 它可以解决 "Missing Parameters: 1" 错误
                    window.OverlayPluginApi.callHandler(JSON.stringify(msg), (data) => {
                        let result = null;
                        try {
                            result = data ? JSON.parse(data) : null;
                        } catch (e) {
                            console.error("Error parsing result:", e);
                        }
                        resolve(result);
                    });
                } catch (e) {
                    console.error("OverlayPluginApi call failed:", e);
                    reject(e);
                }
            } else {
                resolve();
            }
        });
    };

    // 初始化
    function waitForApi() {
        if (!window.OverlayPluginApi && !window.dispatchOverlayEvent) {
            setTimeout(waitForApi, 300);
            return;
        }

        var api = window.OverlayPluginApi;

        if (api) {
            overlayWindowId = window.name;
            // 握手
            callOverlayHandler({ call: 'getLanguage' });
        }
    }

    waitForApi();

    if (!window.dispatchOverlayEvent) {
        window.dispatchOverlayEvent = function (event) {
            var evt = new CustomEvent(event.type, { detail: event.detail });
            document.dispatchEvent(evt);
        };
    }
})();
