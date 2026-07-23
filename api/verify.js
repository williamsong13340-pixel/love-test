// api/verify.js
// Vercel Serverless Function - 安全升级版（HMAC-SHA256 签名 + 首次激活起算30天 + 3次额度核销 + Fail-Safe 容错）

import crypto from 'crypto';

const optStd = [
    { text: "完全符合", score: 4 }, { text: "比较符合", score: 3 }, 
    { text: "比较不符合", score: 2 }, { text: "完全不符合", score: 1 }
];
const optRev = [
    { text: "完全符合", score: 1 }, { text: "比较符合", score: 2 }, 
    { text: "比较不符合", score: 3 }, { text: "完全不符合", score: 4 }
];
const optVeto = [
    { text: "是", score: 1 }, { text: "否", score: 4 }
];

// 54道完整题库
const rawQuestions = [
    { id: 1, dimIndex: 0, q: "当我分享一件开心的小事时，TA会放下手机看着我回应。", options: optStd },
    { id: 2, dimIndex: 1, q: "答应过我的日常小事（如买个东西、倒垃圾），TA经常忘记或推脱。", options: optRev },
    { id: 3, dimIndex: 2, q: "当我们对某件事有分歧时，TA会努力寻找我们都能接受的折中方案。", options: optStd },
    { id: 4, dimIndex: 3, q: "TA经常试图改变我的穿衣风格或我个人的生活习惯。", options: optRev },
    { id: 5, dimIndex: 4, q: "我们每周都会有纯粹享受彼此陪伴的时光（哪怕只是牵手散步）。", options: optStd },
    { id: 6, dimIndex: 5, q: "TA的情绪就像天气一样难以预测，我经常需要“察言观色”。", options: optRev },
    { id: 7, dimIndex: 0, q: "在我遇到工作或生活上的挫折时，TA的第一反应是倾听和拥抱，而不是急着“教我做事”。", options: optStd },
    { id: 8, dimIndex: 1, q: "涉及到两人共同开销或未来规划时，TA总是逃避讨论。", options: optRev },
    { id: 9, dimIndex: 2, q: "吵架后，TA经常使用“冷暴力”（几天不理我）来应对。", options: optRev },
    { id: 10, dimIndex: 3, q: "TA支持我拥有自己的社交圈，我出去和朋友聚会时TA不会阴阳怪气。", options: optStd },
    { id: 11, dimIndex: 4, q: "走在路上或看电视时，TA会自然地与我有肢体接触（如搭肩膀、牵手）。", options: optStd },
    { id: 12, dimIndex: 5, q: "即使在压力很大的情况下，TA也很少对我大吼大叫。", options: optStd },
    { id: 13, dimIndex: 0, q: "当我表达难过或委屈时，TA常说“你想太多了”或“这有什么好哭的”。", options: optRev },
    { id: 14, dimIndex: 1, q: "家里需要维修或统筹的事情，TA会主动承担，而不是等我安排。", options: optStd },
    { id: 15, dimIndex: 2, q: "TA在生气时，依然能就事论事，不会翻旧账或对我进行人身攻击。", options: optStd },
    { id: 16, dimIndex: 3, q: "TA未经我允许，绝不会私自翻看我的手机或日记。", options: optStd },
    { id: 17, dimIndex: 4, q: "我们的性生活或亲密接触，越来越像是在例行公事，或者干脆没有。", options: optRev },
    { id: 18, dimIndex: 5, q: "如果遇到突发状况（如车抛锚、生病），TA能迅速冷静下来解决问题。", options: optStd },
    { id: 19, dimIndex: 0, q: "我可以毫无顾忌地向TA展示我脆弱、不完美的一面。", options: optStd },
    { id: 20, dimIndex: 1, q: "TA对自己的职业或生活完全没有长期规划，总是走一步看一步。", options: optRev },
    { id: 21, dimIndex: 2, q: "每当TA做错事时，TA总能找到理由证明“那是别人的错”或“是你逼我的”。", options: optRev },
    { id: 22, dimIndex: 3, q: "当我取得成就时，TA会由衷地为我高兴，而不是感到嫉妒或贬低我。", options: optStd },
    { id: 23, dimIndex: 4, q: "我们之间有只有我们两个才懂的“内部笑话”或专属昵称。", options: optStd },
    { id: 24, dimIndex: 5, q: "TA很容易因为别人无心的一句话而暴跳如雷或陷入长时间的情绪低落。", options: optRev },
    { id: 25, dimIndex: 0, q: "即使TA不能完全理解我的爱好，TA也愿意花时间听我谈论它们。", options: optStd },
    { id: 26, dimIndex: 1, q: "当讨论到婚姻、生育或养老等现实问题时，TA的回答总是非常敷衍。", options: optRev },
    { id: 27, dimIndex: 2, q: "TA能够真诚地说出“对不起”，并采取行动改正。", options: optStd },
    { id: 28, dimIndex: 3, q: "TA总是用“我是为了你好”作为借口，强迫我做我不喜欢的事。", options: optRev },
    { id: 29, dimIndex: 4, q: "当我们在同一个房间各做各的事情时，我也能感觉到一种安心的连结感。", options: optStd },
    { id: 30, dimIndex: 5, q: "在外面遇到不顺心的事情（如堵车、服务员态度不好），TA经常破口大骂。", options: optRev },
    { id: 31, dimIndex: 0, q: "在我生病不舒服时，TA会主动照顾我，而不是只在嘴上说“多喝热水”。", options: optStd },
    { id: 32, dimIndex: 1, q: "TA花钱大手大脚，或有隐瞒我的债务。", options: optRev },
    { id: 33, dimIndex: 2, q: "当我试图指出TA的问题时，TA会立刻反击，列举出我的一堆缺点。", options: optRev },
    { id: 34, dimIndex: 3, q: "TA尊重我的个人空间，如果我想一个人静静，TA不会觉得我是不爱TA了。", options: optStd },
    { id: 35, dimIndex: 4, q: "我们能够坦诚地交流对彼此身体或亲密接触的需求和感受。", options: optStd },
    { id: 36, dimIndex: 5, q: "TA在上一秒还很高兴，下一秒可能就会因为一件极小的事对我不耐烦。", options: optRev },
    { id: 37, dimIndex: 0, q: "我常常觉得，比起伴侣，我更像TA的心理医生或情绪垃圾桶。", options: optRev },
    { id: 38, dimIndex: 1, q: "我们在分配家务时是相对公平的，TA不会认为某类家务天生就该我做。", options: optStd },
    { id: 39, dimIndex: 2, q: "当问题解决后，我们能够轻松地翻篇，TA不会暗自记恨。", options: optStd },
    { id: 40, dimIndex: 3, q: "TA常常在别人面前拿我的缺点开玩笑，即使我表达过不悦。", options: optRev },
    { id: 41, dimIndex: 4, q: "我们看着对方眼睛的时候，我依然能感觉到心动和爱意。", options: optStd },
    { id: 42, dimIndex: 5, q: "TA有适合自己的压力排解方式（如运动、爱好），而不是把压力发泄在我身上。", options: optStd },
    { id: 43, dimIndex: 0, q: "我感到不舒服但没有说出口时，TA经常能敏锐地察觉到我的状态。", options: optStd },
    { id: 44, dimIndex: 1, q: "TA对于“对父母的赡养”和“对我们小家庭的投入”有清晰且合理的界限。", options: optStd },
    { id: 45, dimIndex: 2, q: "TA在沟通时常用“你总是……”或“你从不……”这样绝对化的词语。", options: optRev },
    { id: 46, dimIndex: 3, q: "TA尊重我的信仰、价值观和人生理想，即使那和TA的不同。", options: optStd },
    { id: 47, dimIndex: 4, q: "除了爱情，我觉得我们也是能够无话不谈的最好朋友。", options: optStd },
    { id: 48, dimIndex: 5, q: "TA很少因为工作劳累或心情不好，就对我摆臭脸。", options: optStd },
    
    { id: 49, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA表现出了潜在的肢体暴力或家暴倾向：</strong><br>心理学真相：暴力只有0次和无数次。摔砸物品在心理学上叫做“替代性暴力”，是直接对你施暴的前奏。<br>行动指南：保证人身安全，保留证据，立刻联系外界寻求庇护。", q: "【关键排查】TA是否曾经在争吵中，对你进行过任何形式的推搡、拉扯、打骂，或摔砸过物品？", options: optVeto },
    { id: 50, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA可能在对你进行煤气灯效应等精神操纵：</strong><br>心理学真相：这是一种极度恶劣的心理虐待。TA通过不断否定你的记忆、感知和理智，试图在精神上摧毁你、重塑你。<br>行动指南：相信直觉，开始用录音或日记记录事实，找回现实锚点，寻求支持。", q: "【关键排查】TA是否经常让你对自己的记忆或精神状态产生怀疑（如说“你有病吧/你记错了吧”）？", options: optVeto },
    { id: 51, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA表现出了极端的情感勒索与控制欲：</strong><br>心理学真相：用自杀或自残来威胁不分手，是一种极度病态的情感勒索。这反映了TA内心巨大的“被抛弃恐惧”。<br>行动指南：不要因为同情或恐惧而留下。分手时必须有第三方在场介入，完成彻底隔离。", q: "【关键排查】TA是否曾用自残、自杀或极其极端的手段阻止你分手或离开？", options: optVeto },
    { id: 52, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA试图强制控制你的生活并隔离你的社交系统：</strong><br>心理学真相：控制财务和社交圈，是为了剪断你的翅膀，这是重度精神操控的核心表现。<br>行动指南：悄悄重建你的私密账户和社交联系，为撤离做准备。", q: "【关键排查】TA是否曾监控你的行踪、限制你的财务，或阻止你见某些特定的朋友/家人？", options: optVeto },
    { id: 53, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA在关系中流露出了对你极度的轻蔑与侮辱：</strong><br>心理学真相：“鄙视”是预测分手准确率最高的指标（93%）。辱骂、翻白眼，说明TA在心理地位上将你视作次等，爱意枯竭。<br>行动指南：离开这个剥夺你尊严的人，去那些能看到你价值的地方。", q: "【关键排查】在争吵时，TA是否曾使用侮辱性极强的词汇辱骂你，或流露出极度鄙夷的神情？", options: optVeto },
    { id: 54, dimIndex: -1, isVeto: true, vetoReason: "<strong style='color:#d32f2f;'>TA存在严重且拒绝治疗的毁灭性成瘾行为：</strong><br>心理学真相：严重成瘾会彻底改变大脑系统。只要TA拒绝专业医疗，你的陪伴就等于“协同毁灭”。<br>行动指南：坚决切割。成瘾是医学问题，你治不了TA，只能自救。", q: "【关键排查】TA是否有严重的成瘾行为（如赌博、酗酒、药物滥用）且拒绝寻求专业治疗？", options: optVeto }
];

const SECRET_KEY = process.env.SECRET_KEY || 'LoveTest_Default_HMAC_Secret_2026#Key!';
const MAX_USAGE = 3; // 每个验证码最多测试 3 次
const VALID_DURATION_DAYS = 30; // 首次激活后有效天数
const VALID_DURATION_MS = VALID_DURATION_DAYS * 24 * 60 * 60 * 1000; // 30天的毫秒数

// 辅助计算 3 位 36进制 HMAC-SHA256 校验和
export function calculateChecksum(baseStr, secretKey = SECRET_KEY) {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(baseStr);
    const hexHash = hmac.digest('hex');
    
    const num = parseInt(hexHash.substring(0, 8), 16);
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const mod = num % (36 * 36 * 36);
    
    const c1 = chars[Math.floor(mod / (36 * 36))];
    const c2 = chars[Math.floor((mod % (36 * 36)) / 36)];
    const c3 = chars[mod % 36];
    
    return c1 + c2 + c3;
}

// 首次激活 + 次数核销逻辑（带 1.5s 超时容错保护）
async function checkActivationAndUsage(cleanCode) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    // 未配置 Redis 时启动 Fail-Safe 容错保护（自动放行）
    if (!redisUrl || !redisToken) {
        return { status: 'OK', currentUsage: 1, isFallback: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
        const key = `code:activation:${cleanCode}`;
        
        // 先获取已有的激活档案
        const getRes = await fetch(`${redisUrl}/get/${key}`, {
            headers: { Authorization: `Bearer ${redisToken}` },
            signal: controller.signal
        });
        const getData = await getRes.json();
        
        const now = Date.now();
        let record = null;

        if (getData && getData.result) {
            try { record = JSON.parse(getData.result); } catch (e) {}
        }

        if (!record) {
            // ----- 首次激活流程 -----
            record = {
                usageCount: 1,
                firstActivatedAt: now
            };
            
            // 写入 Redis 并设置 30 天自动过期物理清理 (2592000 秒)
            await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(JSON.stringify(record))}/EX/2592000`, {
                headers: { Authorization: `Bearer ${redisToken}` },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return { status: 'OK', currentUsage: 1, isFirstActivation: true, isFallback: false };
        } else {
            // ----- 已激活后续使用流程 -----
            // 1. 检查自首次激活起是否已过 30 天
            const elapsedMs = now - record.firstActivatedAt;
            if (elapsedMs > VALID_DURATION_MS) {
                clearTimeout(timeoutId);
                return { status: 'EXPIRED', isFallback: false };
            }

            // 2. 检查 3 次使用额度
            if (record.usageCount >= MAX_USAGE) {
                clearTimeout(timeoutId);
                return { status: 'LIMIT_EXCEEDED', isFallback: false };
            }

            // 次数 +1 并更新 Redis
            record.usageCount += 1;
            const remainingTtlSeconds = Math.max(1, Math.floor((VALID_DURATION_MS - elapsedMs) / 1000));
            
            await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(JSON.stringify(record))}/EX/${remainingTtlSeconds}`, {
                headers: { Authorization: `Bearer ${redisToken}` },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return { status: 'OK', currentUsage: record.usageCount, isFirstActivation: false, isFallback: false };
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn("⚠️ Upstash Redis 触发容错保护 (Fail-Safe 降级放行):", err.message);
        return { status: 'OK', currentUsage: 1, isFallback: true };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '不允许的请求方法' });
    }

    if (!req.body || typeof req.body.code === 'undefined') {
        return res.status(400).json({ success: false, message: '请求参数缺失！' });
    }

    const { code } = req.body;
    
    if (!code) {
        return res.status(401).json({ success: false, message: '请输入测试码！' });
    }

    const cleanCode = String(code).trim().toUpperCase();

    // 格式校验：必须为 16 位 (CCK-4位时间戳-4位随机3位签名)
    if (!cleanCode.startsWith('CCK-') || cleanCode.length !== 16) {
        return res.status(401).json({ success: false, message: '❌ 测试码格式不正确，请输入形如 CCK-XXXX-XXXXXXX 的 16 位专属码。' });
    }

    const bodyStr = cleanCode.replace('CCK-', '').replace(/-/g, ''); 
    const timeStr = bodyStr.substring(0, 4);
    const randStr = bodyStr.substring(4, 8);
    const providedChecksum = bodyStr.substring(8, 11);

    // 1. HMAC 签名防伪防爆破校验（即使发码放了半年，签名依然永远有效）
    const baseStr = timeStr + randStr;
    const expectedChecksum = calculateChecksum(baseStr, SECRET_KEY);

    if (providedChecksum !== expectedChecksum) {
        return res.status(401).json({ success: false, message: '❌ 无效的测试码（防伪签名校验失败，请核对是否输错）。' });
    }

    // 2. 首次使用激活起算 30 天 + 3 次测试额度核销
    const activationResult = await checkActivationAndUsage(cleanCode);

    if (activationResult.status === 'EXPIRED') {
        return res.status(401).json({
            success: false,
            message: `⚠️ 该测试码自首次激活之日起已超过 30 天，已自然失效。`
        });
    }

    if (activationResult.status === 'LIMIT_EXCEEDED') {
        return res.status(401).json({
            success: false,
            message: `❌ 该测试码的 3 次测试额度已全部用尽，无法再次开启测试。`
        });
    }

    const remaining = MAX_USAGE - activationResult.currentUsage;
    let usageMsg = `验证成功！`;
    if (activationResult.isFallback) {
        usageMsg += ` 测试码已成功激活（自今日起 30 天内有效），还可测试 2 次。`;
    } else {
        if (activationResult.isFirstActivation) {
            usageMsg += ` 测试码已成功激活（自今日起 30 天内有效），还可测试 ${remaining} 次。`;
        } else {
            usageMsg += remaining > 0 ? ` 该测试码还可使用 ${remaining} 次。` : ` 这是该测试码最后 1 次测试额度。`;
        }
    }

    // 全部通过！安全下发 54 道问卷数据
    res.status(200).json({ 
        success: true, 
        message: usageMsg, 
        questions: rawQuestions 
    });
}
