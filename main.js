const API_BASE = "http://localhost:3000";
const statusElement = document.getElementById("status-text");
const partyListElement = document.getElementById("party-list");
const zoneIdInput = document.getElementById("zone-id-input");

// Custom Dropdown Elements
const selectTrigger = document.getElementById("select-trigger");
const selectOptions = document.getElementById("select-options");
const options = document.querySelectorAll(".option");

let currentZoneId = zoneIdInput.value;

document.addEventListener("DOMContentLoaded", () => {
    console.log("Overlay loaded.");
    statusElement.innerText = "等待 ACT 连接...";

    // 监听 Zone ID 输入变化
    zoneIdInput.addEventListener("change", (e) => {
        currentZoneId = e.target.value;
        if (currentParty.length > 0) {
            refreshPartyStatus(); // 重新查询
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

            // Update input
            zoneIdInput.value = val;
            currentZoneId = val;

            // Update trigger text (optional, or keep "快速选择")
            // selectTrigger.innerText = text.split(' ')[0]; // E.g., "M9S"

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

        callOverlayHandler({ call: "getParty" }).then(data => {
            console.log("[DEBUG] Manual getParty result:", data);

            if (data.party && data.party.length > 0) {
                statusElement.innerText = `获取到 ${data.party.length} 个队员`;
                // 直接使用获取到的数据渲染
                currentParty = data.party;
                renderPartyList(currentParty);
                refreshPartyStatus();
            } else {
                statusElement.innerText = "未检测到小队";
                console.log("[DEBUG] getParty returned empty list.");
                currentParty = [];
                renderPartyList([]);
            }
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

const JOB_NAMES = {
    19: "PLD", 21: "WAR", 32: "DRK", 37: "GNB",
    24: "WHM", 28: "SCH", 33: "AST", 40: "SGE",
    20: "MNK", 22: "DRG", 30: "NIN", 34: "SAM", 39: "RPR",
    23: "BRD", 31: "MCH", 38: "DNC",
    25: "BLM", 27: "SMN", 35: "RDM",
};

function getJobName(jobId) {
    return JOB_NAMES[jobId] || "???";
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

        // 初始状态
        let statusHtml = `<span class="status unknown">...</span>`;

        li.innerHTML = `
            <span class="job-icon">${jobName}</span>
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
