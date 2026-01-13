const API_BASE = "http://localhost:3000";

// ============ 模拟数据用于测试 (设置 MOCK_MODE = true 启用) ============
const MOCK_MODE = false; // 设置为 true 启用模拟数据进行调试

const MOCK_PARTY = [
    { name: "测试玩家一", job: 19, inParty: true, contentId: "1001", worldId: 1042 },
    { name: "测试玩家二", job: 24, inParty: true, contentId: "1002", worldId: 1042 },
    { name: "测试玩家三", job: 20, inParty: true, contentId: "1003", worldId: 1076 },
    { name: "测试玩家四", job: 23, inParty: true, contentId: "1004", worldId: 1043 },
    { name: "测试玩家五", job: 25, inParty: true, contentId: "1005", worldId: 1180 },
    { name: "测试玩家六", job: 28, inParty: true, contentId: "1006", worldId: 1042 },
    { name: "测试玩家七", job: 22, inParty: true, contentId: "1007", worldId: 1042 },
    { name: "测试玩家八", job: 31, inParty: true, contentId: "1008", worldId: 1042 },
];

const MOCK_PROGRESS_DATA = {
    "1001": { clear: true, updated_at: Date.now() - 3600000 },
    "1002": { clear: false, progress: { enemy_hp: 0.45, enemy_id: 123 }, updated_at: Date.now() - 7200000 },
    "1003": { clear: false, progress: { enemy_hp: 0.12, enemy_id: 123 }, updated_at: Date.now() - 86400000 },
    "1004": { cleared: true, fight: { start_time: Date.now() - 172800000 } },
    "1005": { clear: false, progress: { enemy_hp: 0, enemy_id: 0 } },
    "1006": { error: true },
    "1007": { clear: false, progress: 7500, updated_at: Date.now() - 300000 },
    "1008": { desc: "无记录" },
};

function getMockProgress(contentId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(MOCK_PROGRESS_DATA[contentId] || { desc: "无记录" });
        }, 200);
    });
}
// ============ 模拟数据结束 ============

const statusElement = document.getElementById("status-text");
const partyListElement = document.getElementById("party-list");
const overlayContainer = document.getElementById("overlay-container");

// Custom Dropdown Elements
const selectTrigger = document.getElementById("select-trigger");
const selectOptions = document.getElementById("select-options");
const options = document.querySelectorAll(".option");

let currentZoneId = "1321"; // 默认值
let isInCombat = false; // 战斗状态
let partyCount = 0; // 小队人数

// 根据条件显示/隐藏悬浮窗
function updateOverlayVisibility() {
    // 战斗中或小队人数<=1时隐藏
    if (isInCombat || partyCount <= 1) {
        overlayContainer.style.display = "none";
    } else {
        overlayContainer.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("Overlay loaded.");
    statusElement.innerText = "等待 ACT 连接...";

    // 监听战斗状态变化
    addOverlayListener("onInCombatChangedEvent", (data) => {
        console.log("[DEBUG] Combat state changed:", data);
        isInCombat = data.inACTCombat || data.inGameCombat;
        updateOverlayVisibility();
    });

    // 监听小队变化
    addOverlayListener("PartyChanged", (data) => {
        console.log("[DEBUG] Party changed:", data);
        if (data && data.party) {
            partyCount = data.party.filter(m => m.inParty).length;
            console.log("[DEBUG] Party count:", partyCount);

            // 更新小队列表
            if (partyCount > 1) {
                currentParty = data.party;
                renderPartyList(currentParty);
                statusElement.innerText = `小队 ${partyCount} 人`;
                refreshPartyStatus();
            }

            updateOverlayVisibility();
        }
    });

    // Custom Dropdown Logic
    selectTrigger.addEventListener("click", (e) => {
        // Toggle visibility
        selectOptions.classList.toggle("show");
        e.stopPropagation(); // Prevent document click from closing immediately
    });

    options.forEach(option => {
        option.addEventListener("click", (e) => {
            const val = e.target.getAttribute("data-value");
            const text = e.target.innerText;

            // Update current zone
            currentZoneId = val;

            // Update trigger text to show selected option
            selectTrigger.innerText = text;

            // Hide dropdown
            selectOptions.classList.remove("show");

            // Refresh
            if (currentParty.length > 0) {
                refreshPartyStatus();
            }
            e.stopPropagation();
        });
    });

    // Click outside to close
    document.addEventListener("click", () => {
        selectOptions.classList.remove("show");
    });

    // Refresh Button Logic
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.addEventListener("click", () => {
        statusElement.innerText = "正在获取小队...";
        console.log("[DEBUG] Manual refresh triggered.");

        // 模拟模式：使用模拟数据
        if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE) {
            console.log("[DEBUG] Using MOCK data.");
            partyCount = MOCK_PARTY.filter(m => m.inParty).length;
            statusElement.innerText = `小队 ${partyCount} 人 (模拟)`;
            currentParty = MOCK_PARTY;
            renderPartyList(currentParty);
            refreshPartyStatus();
            updateOverlayVisibility();
            return;
        }

        callOverlayHandler({ call: "getParty" }).then(data => {
            console.log("[DEBUG] Manual getParty result:", data);

            if (data && data.party && data.party.length > 0) {
                partyCount = data.party.filter(m => m.inParty).length;
                statusElement.innerText = `小队 ${partyCount} 人`;
                // 直接使用获取到的数据渲染
                currentParty = data.party;
                renderPartyList(currentParty);
                refreshPartyStatus();
                updateOverlayVisibility();
            } else {
                statusElement.innerText = "未检测到小队";
                console.log("[DEBUG] getParty returned empty list.");
                partyCount = 0;
                currentParty = [];
                renderPartyList([]);
                updateOverlayVisibility();
            }
        }).catch(err => {
            console.error("[DEBUG] Error calling getParty:", err);
            statusElement.innerText = "获取小队失败";
            partyCount = 0;
            currentParty = [];
            renderPartyList([]);
            updateOverlayVisibility();
        });
    });

});

let currentParty = [];

// handlePartyChanged 已移除，逻辑整合至 refresh handler

async function refreshPartyStatus() {
    console.log(`[DEBUG] Refreshing party status for ${currentParty.length} members.`);

    // 使用串行请求防止并发过高导致的数据混乱或 API 限制
    for (const member of currentParty) {
        if (!member.inParty) continue;

        // 模拟模式：使用模拟数据
        if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE) {
            try {
                const progress = await getMockProgress(member.contentId);
                console.log(`[DEBUG] Mock result for ${member.name}:`, JSON.stringify(progress));
                updateMemberStatus(member.contentId, progress);
            } catch (e) {
                console.error(`[DEBUG] Error fetching mock ${member.name}:`, e);
                updateMemberStatus(member.contentId, { error: true });
            }
            continue;
        }

        let server = member.WorldName || member.worldName;
        const rawWorldId = member.worldId;

        if (rawWorldId && WORLD_ID_MAP[rawWorldId]) {
            server = WORLD_ID_MAP[rawWorldId];
        } else if (!server && rawWorldId) {
            // Fallback if not in map and no server name provided
            server = "Unknown";
        }

        if (!server) {
            server = "Unknown";
            console.warn(`[DEBUG] Server Unknown for ${member.name}, ID: ${rawWorldId}`);
        }

        // console.log(`[DEBUG] Fetching: ${member.name} @ ${server} (Zone: ${currentZoneId})`);

        try {
            const progress = await fetchMemberProgress(member.name, server, currentZoneId);
            console.log(`[DEBUG] Result for ${member.name}:`, JSON.stringify(progress));
            // Use contentId as unique identifier
            updateMemberStatus(member.contentId, progress);
        } catch (e) {
            console.error(`[DEBUG] Error fetching ${member.name}:`, e);
            updateMemberStatus(member.contentId, { error: true });
        }

        // 可选：添加小延迟 (e.g. 100ms)
        // await new Promise(r => setTimeout(r, 100));
    }
}


async function fetchMemberProgress(name, server, zoneId) {
    try {
        // 根据提供的 API 代码:
        // getMemberZoneBestProgress => GET /member/${name}@${server}/${zoneID}/best
        const url = `${API_BASE}/member/${encodeURIComponent(name)}@${encodeURIComponent(server)}/${encodeURIComponent(zoneId)}/best`;
        console.log(`[DEBUG] API Request: ${url}`);

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            // 404 可能意味着没有任何记录
            if (response.status === 404) return { cleared: false, progress: 0, desc: "无记录" };
            throw new Error(`API Error ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("Fetch failed:", e);
        return { error: true };
    }
}

// CN World ID Mapping (部分常见)
// 数据来源: xivapi-cn / Universalis-CN
const WORLD_ID_MAP = {
    // 陆行鸟 (Chocobo)
    1042: "拉诺西亚", 1044: "幻影群岛", 1060: "萌芽池", 1081: "神意之地",
    1167: "红玉海", 1173: "宇宙和音", 1174: "沃仙曦染", 1175: "晨曦王座",
    // 莫古力 (Moogle)
    1076: "白金幻象", 1113: "旅人栈桥", 1121: "拂晓之间", 1166: "龙巢神殿",
    1170: "潮风亭", 1171: "神拳痕", 1172: "白银乡", 1176: "梦羽宝境",
    // 猫小胖 (FatCat)
    1043: "紫水栈桥", 1045: "摩杜纳", 1106: "静语庄园", 1169: "延夏",
    1177: "海猫茶屋", 1178: "柔风海湾", 1179: "琥珀原",
    // 豆豆柴 (Doudouchai)
    1180: "太阳海岸", 1183: "银泪湖", 1186: "伊修加德", 1192: "水晶塔",
    1200: "亚马乌罗提", 1201: "红茶川"
};

// 辅助: 格式化时间 (例如: "2小时前", "刚刚")
function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    const now = Date.now();
    // 假设 timestamp 是毫秒，如果是秒需要 * 1000
    // 通常 API 返回可能是 ISOString 或者 unix timestamp
    // 这里做个简单判断，如果 timestamp 很小 (小于 2000000000) 当作秒
    let ts = timestamp;
    if (ts < 20000000000) ts *= 1000;

    const diff = now - ts;
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;

    if (diff < min) return "刚刚";
    if (diff < hour) return `${Math.floor(diff / min)} 分前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    return `${Math.floor(diff / day)} 天前`;
}

// 完整职业ID到缩写的映射
const JOB_NAMES = {
    0: "ADV",   // 冒险者
    // 基础职业
    1: "GLA", 2: "PGL", 3: "MRD", 4: "LNC", 5: "ARC",
    6: "CNJ", 7: "THM", 26: "ACN", 29: "ROG",
    // 生产职业
    8: "CRP", 9: "BSM", 10: "ARM", 11: "GSM",
    12: "LTW", 13: "WVR", 14: "ALC", 15: "CUL",
    // 采集职业
    16: "MIN", 17: "BTN", 18: "FSH",
    // 战斗职业
    19: "PLD", 20: "MNK", 21: "WAR", 22: "DRG", 23: "BRD",
    24: "WHM", 25: "BLM", 27: "SMN", 28: "SCH", 30: "NIN",
    31: "MCH", 32: "DRK", 33: "AST", 34: "SAM", 35: "RDM",
    36: "BLU", 37: "GNB", 38: "DNC", 39: "RPR", 40: "SGE",
    41: "VPR", 42: "PCT",
};

// 职业图标URL映射 (根据缩写)
const JOB_ICONS = {
    // 职能图标 (后备用)
    'ROLE_TANK': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/bordered_tank.png',
    'ROLE_HEALER': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/bordered_healer.png',
    'ROLE_MELEE': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/bordered_dps.png',
    'ROLE_RANGED': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/bordered_dps_ranged.png',
    'ROLE_MAGIC': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/bordered_dps_magic.png',
    'ROLE_CRAFTER': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob0.png',
    'ROLE_GATHERER': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob8.png',

    // 基础职业
    'GLA': 'https://xivpf.ff14.xin/pic/062101_hr1.png',
    'MRD': 'https://xivpf.ff14.xin/pic/062102_hr1.png',
    'PGL': 'https://xivpf.ff14.xin/pic/062103_hr1.png',
    'LNC': 'https://xivpf.ff14.xin/pic/062104_hr1.png',
    'ROG': 'https://xivpf.ff14.xin/pic/062129_hr1.png',
    'ARC': 'https://xivpf.ff14.xin/pic/062105_hr1.png',
    'THM': 'https://xivpf.ff14.xin/pic/062107_hr1.png',
    'ACN': 'https://xivpf.ff14.xin/pic/062126_hr1.png',
    'CNJ': 'https://xivpf.ff14.xin/pic/062106_hr1.png',

    // 坦克
    'PLD': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob0.png',
    'WAR': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob1.png',
    'DRK': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob2.png',
    'GNB': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob3.png',

    // 治疗
    'WHM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob4.png',
    'SCH': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob6.png',
    'AST': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob5.png',
    'SGE': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob7.png',

    // 近战DPS
    'MNK': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob8.png',
    'DRG': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob9.png',
    'NIN': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob10.png',
    'SAM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob11.png',
    'RPR': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob12.png',
    'VPR': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/DoW/VPR.png',

    // 远程物理DPS
    'BRD': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob13.png',
    'MCH': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob14.png',
    'DNC': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob15.png',

    // 远程魔法DPS
    'BLM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob16.png',
    'SMN': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob17.png',
    'RDM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob18.png',
    'BLU': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/zjob19.png',
    'PCT': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/DoM/PCT.png',

    // 生产职业
    'CRP': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob0.png',
    'BSM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob1.png',
    'ARM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob2.png',
    'GSM': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob3.png',
    'LTW': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob4.png',
    'WVR': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob5.png',
    'ALC': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob6.png',
    'CUL': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob7.png',

    // 采集职业
    'MIN': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob8.png',
    'BTN': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob9.png',
    'FSH': 'https://static.web.sdo.com/jijiamobile/pic/ff14/ffstones/job/sjob10.png',
};

// 默认图标 (未知职业)
const DEFAULT_JOB_ICON = 'https://fu5.web.sdo.com/10036/202406/17193719548325.png';

function getJobName(jobId) {
    return JOB_NAMES[jobId] || "???";
}

function getJobIcon(jobId) {
    const abbr = JOB_NAMES[jobId];
    if (abbr && JOB_ICONS[abbr]) {
        return JOB_ICONS[abbr];
    }
    return DEFAULT_JOB_ICON;
}

function renderPartyList(party) {
    partyListElement.innerHTML = "";
    party.forEach(member => {
        if (!member.inParty) return;

        const li = document.createElement("li");
        li.className = "member-row";
        // Use contentId as unique identifier
        li.id = `member-${member.contentId}`;

        const jobName = getJobName(member.job);
        const jobIconUrl = getJobIcon(member.job);

        // 初始状态
        let statusHtml = `<span class="status unknown">...</span>`;

        li.innerHTML = `
            <img class="job-icon" src="${jobIconUrl}" alt="${jobName}" title="${jobName}">
            <div class="info-col">
                <span class="name">${member.name}</span>
                <span class="sub-info"></span> 
            </div>
            <div class="status-container">${statusHtml}</div>
        `;
        partyListElement.appendChild(li);
    });
}

function updateMemberStatus(id, data) {
    const li = document.getElementById(`member-${id}`);
    if (!li) return;

    const container = li.querySelector(".status-container");
    const subInfo = li.querySelector(".sub-info");

    let cls = "unknown";
    let text = "未知";
    let subText = ""; // 用于显示更新时间

    if (data.error) {
        cls = "error";
        text = "Err";
    } else if (data.desc === "无记录") {
        cls = "unknown";
        text = "无记录";
    } else if (!data.clear && !data.cleared && data.progress && data.progress.enemy_id === 0) {
        // 新增: 处理 API 返回 200 OK 但 enemy_id 为 0 的空记录情况
        cls = "unknown";
        text = "无记录";
    } else {
        // 1. 处理时间戳
        // 优先使用 data.updated_at (旧兼容), 其次 data.fight.start_time (新结构)
        let tsRaw = data.updated_at;
        if (!tsRaw && data.fight && data.fight.start_time) {
            tsRaw = data.fight.start_time;
        }

        if (tsRaw) {
            let ts = tsRaw;
            // ISO String (e.g. "2026-01-10T...") => Date.parse
            if (typeof ts === 'string') {
                const parsed = Date.parse(ts);
                if (!isNaN(parsed)) ts = parsed;
            } else if (typeof ts === 'number') {
                // heuristic: if small, *1000
                if (ts < 20000000000) ts *= 1000;
            }
            subText = formatTimeAgo(ts);
        }

        // 2. 处理过本状态
        // 兼容 data.clear (boolean) 和 data.cleared (boolean)
        const isCleared = (data.clear === true) || (data.cleared === true);

        if (isCleared) {
            cls = "cleared";
            text = "已过本";
        } else {
            cls = "not-cleared";
            // 3. 进度处理
            // data.progress 可能是一个数字 (0-10000?) 或者对象 { phase, enemy_hp, ... }
            let pVal = 0;
            let pFound = false;

            if (data.progress !== undefined && data.progress !== null) {
                if (typeof data.progress === 'number') {
                    // 旧逻辑: 假设 >100 是 x100
                    pVal = data.progress > 100 ? data.progress / 100 : data.progress;
                    pFound = true;
                } else if (typeof data.progress === 'object') {
                    // 新逻辑: { enemy_hp: 0.123, phase: ... }
                    // 假设 enemy_hp 是剩余血量百分比 (0.0 - 1.0)
                    // 进度 = (1 - hp) * 100
                    if (typeof data.progress.enemy_hp === 'number') {
                        pVal = (1 - data.progress.enemy_hp) * 100;
                        pFound = true;
                    }
                }
            }

            if (pFound) {
                // 限制在 0-100
                if (pVal < 0) pVal = 0;
                if (pVal > 100) pVal = 100;
                text = `${pVal.toFixed(1)}%`;
            } else {
                text = "未过本";
            }
        }
    }

    subInfo.innerText = subText;
    container.innerHTML = `<span class="status ${cls}">${text}</span>`;
}
