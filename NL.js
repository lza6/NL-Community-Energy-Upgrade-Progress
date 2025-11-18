// ==UserScript==
// @name         NL社区显示能量和升级进度
// @namespace    http://tampermonkey.net/
// @version      2025.11.18.1
// @description  在 Nodeloc / Linux.do 等 Discourse 论坛的顶部导航栏显示能量和升级进度。
// @author       IWLZ (Modified by AI)
// @match        https://www.nodeloc.com/*
// @match        https://linux.do/*
// @match        https://clochat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nodeloc.com
// @grant        none
// @license      Apache-2.0 license
// @downloadURL  https://raw.githubusercontent.com/lza6/NL-Community-Energy-Upgrade-Progress/main/NL.js
// @updateURL    https://raw.githubusercontent.com/lza6/NL-Community-Energy-Upgrade-Progress/main/NL.js
// ==/UserScript==

(function () {
    'use strict';

    console.log("能量显示脚本已注入，开始等待页面元素...");

    const MAX_ATTEMPTS = 60; // 最多尝试60次 (60 * 500ms = 30秒)
    let attempts = 0;

    // 主初始化函数
    function initializeScript() {
        // 检查脚本是否已经运行过，防止重复插入
        if (document.getElementById('nodeScoreHeader_score_id')) {
            clearInterval(initInterval);
            return;
        }

        // 需要等待的关键元素
        const headerIcons = document.querySelector(".d-header-icons");
        const userMenu = document.querySelector("#current-user");
        const preloadedDataEl = document.getElementById('data-preloaded');

        if (!headerIcons || !userMenu || !preloadedDataEl) {
            return;
        }

        // --- 关键元素已准备就绪 ---
        clearInterval(initInterval);
        console.log("核心UI元素已找到，开始执行主逻辑。");

        let username;
        try {
            // 第一次解析：将整个 data-preloaded 属性从字符串转为对象
            const preloadedData = JSON.parse(preloadedDataEl.dataset.preloaded);

            // [核心修复] 第二次解析：currentUser 的值本身也是一个字符串，需要再次解析
            const currentUserInfo = JSON.parse(preloadedData.currentUser);

            username = currentUserInfo.username;
        } catch (e) {
            console.error("解析预加载数据失败:", e);
            return;
        }

        if (!username) {
            console.log("未登录或无法获取用户名。");
            return;
        }

        console.log(`成功获取到用户: ${username}`);

        const ifShowUpgradeProgress = window.location.origin === "https://www.nodeloc.com";

        insertUIElements(username, ifShowUpgradeProgress);
        getPower(username);
    }

    // 设置定时器，每500毫秒尝试执行一次初始化函数
    const initInterval = setInterval(() => {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
            clearInterval(initInterval);
            console.error("能量显示脚本：等待页面元素超时（30秒），脚本终止。请检查网站结构是否已更改。");
            return;
        }
        initializeScript();
    }, 500);


    // --- 以下是辅助函数 ---

    function insertUIElements(username, showUpgrade) {
        const headerUL = document.querySelector(".d-header-icons");
        if (!headerUL) return;

        // 创建能量显示元素
        const powerElement = document.createElement('li');
        powerElement.id = 'nodeScoreHeader_score_id';
        powerElement.className = 'header-dropdown-toggle';
        powerElement.innerHTML = `
            <a class="icon btn-flat" title="当前能量" style="color: green; font-weight: bold; padding: 0 8px; cursor: pointer;">
                <span id="nodeScoreHeader_id_val">...</span>
            </a>`;
        powerElement.addEventListener("mouseenter", () => getPower(username));

        // 创建升级进度图标
        let upgradeIcon = null;
        if (showUpgrade) {
            upgradeIcon = document.createElement('li');
            upgradeIcon.className = 'header-dropdown-toggle';
            upgradeIcon.id = `upgradeIcon_id`;
            upgradeIcon.style.position = 'relative';
            upgradeIcon.innerHTML = `
                <a class="icon btn-flat" title="升级进度" style="cursor: pointer;">
                    <svg class="fa d-icon d-icon-arrow-up svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#arrow-up"></use></svg>
                </a>
                <div id="showUpgradeDetail_div" style="position: absolute; background-color: var(--secondary); box-shadow: 0 4px 16px rgba(0,0,0,0.12); display: none; padding: 15px; border-radius: 5px; min-width: 280px; right: 0; top: 100%; z-index: 1000;">
                    <div id="home-quick-access-upgrade-progress">Loading...</div>
                </div>`;
            const upgradePanel = upgradeIcon.querySelector('#showUpgradeDetail_div');
            upgradeIcon.addEventListener("mouseenter", () => showUpgradeDetail(username, upgradePanel));
            upgradeIcon.addEventListener("mouseleave", () => hideUpgradeDetail(upgradePanel));
        }

        // 插入元素
        const userMenu = headerUL.querySelector("#current-user");
        if (userMenu) {
            if (upgradeIcon) headerUL.insertBefore(upgradeIcon, userMenu);
            headerUL.insertBefore(powerElement, userMenu);
        } else {
            if (upgradeIcon) headerUL.insertBefore(upgradeIcon, headerUL.firstChild);
            headerUL.insertBefore(powerElement, headerUL.firstChild);
        }
    }

    function getPower(username) {
        if (!username) return;
        const url = `${window.location.origin}/u/${username}.json`;
        fetch(url)
            .then(response => response.ok ? response.json() : Promise.reject('网络请求失败'))
            .then(data => {
                const scoreEl = document.getElementById("nodeScoreHeader_id_val");
                if (scoreEl) scoreEl.innerText = data.user.gamification_score;
            })
            .catch(error => {
                console.error('获取能量失败:', error);
                const scoreEl = document.getElementById("nodeScoreHeader_id_val");
                if (scoreEl) scoreEl.innerText = "N/A";
            });
    }

    function getUpgradeProgress(username, panelContent) {
        const url = `${window.location.origin}/u/${username}/upgrade-progress.json`;
        panelContent.innerHTML = `Loading...`;
        fetch(url)
            .then(response => response.ok ? response.json() : Promise.reject('网络请求失败'))
            .then(data => {
                const unmet_conditionsEL = data.unmet_conditions.map(c => `<li>${c}</li>`).join('');
                const met_conditionsEL = data.met_conditions.map(c => `<li>${c}</li>`).join('');
                panelContent.innerHTML = `
                    <div class="upgrade-progress-panel" style="color: var(--primary-high);">
                        <h3>下一等级：${data.next_level_name}</h3>
                        <div style="background: var(--primary-low); border-radius: 5px; margin: 10px 0; overflow: hidden;">
                            <div style="width: ${data.progress_percent}%; background: var(--tertiary); height: 8px; border-radius: 5px;"></div>
                        </div>
                        ${unmet_conditionsEL ? `<h4>未满足条件</h4><ul>${unmet_conditionsEL}</ul>` : ''}
                        ${met_conditionsEL ? `<h4>已满足条件</h4><ul>${met_conditionsEL}</ul>` : ''}
                    </div>`;
            })
            .catch(error => {
                console.error('获取升级进度失败:', error);
                panelContent.innerHTML = '加载失败';
            });
    }

    function showUpgradeDetail(username, panel) {
        if (username) {
            getUpgradeProgress(username, panel.querySelector('#home-quick-access-upgrade-progress'));
        }
        panel.style.display = 'block';
    }

    function hideUpgradeDetail(panel) {
        panel.style.display = 'none';
    }
})();
