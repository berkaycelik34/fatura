/**
 * Belgeyi üreten cihazın künyesi. PDF'te EXIF yoktur; bu bilgiler PDF'in belge
 * künyesine (Creator/Producer/Subject/Keywords) yazılır ve herhangi bir PDF
 * görüntüleyicinin "belge özellikleri" ekranından okunabilir. Gizli bir alan
 * değildir: dosyayı alan herkes görebilir.
 *
 * Yalnızca tarayıcının açtığı bilgiler doldurulur. Donanım seri numarası, MAC
 * adresi, disk kimliği gibi bilgiler web sayfalarına verilmez; bilgisayar
 * modeli de yalnızca bazı platformlarda (ör. Android) bildirilir.
 */
export interface DeviceAudit {
    at: string;
    timezone: string;
    language: string;
    userAgent: string;
    platform: string;
    osVersion: string;
    model: string;
    architecture: string;
    cpuCores: string;
    memoryGb: string;
    screen: string;
    /** Yalnızca kullanıcı açıkça istediğinde doldurulur; dış servise sorulur. */
    ip?: string;
}

interface HighEntropyValues {
    platform?: string;
    platformVersion?: string;
    model?: string;
    architecture?: string;
    bitness?: string;
}

interface UserAgentData {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>;
}

const UNKNOWN = "bilinmiyor";

/** Genel IP sorulan servis; anahtar kapalıyken hiç çağrılmaz. */
export const IP_SERVICE = "api.ipify.org";

async function readHighEntropy(): Promise<HighEntropyValues> {
    const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    if (!data?.getHighEntropyValues) return {};
    try {
        return await data.getHighEntropyValues(["platform", "platformVersion", "model", "architecture", "bitness"]);
    } catch {
        return {};
    }
}

/** Genel IP adresi tarayıcıda bilinmez; istenirse dış bir servise sorulur. */
async function readPublicIp(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const response = await fetch(`https://${IP_SERVICE}?format=json`, { signal: controller.signal });
        if (!response.ok) return "alınamadı";
        const data = (await response.json()) as { ip?: string };
        return data.ip ?? "alınamadı";
    } catch {
        return "alınamadı";
    } finally {
        clearTimeout(timer);
    }
}

export async function collectDeviceAudit(includeIp: boolean): Promise<DeviceAudit> {
    const hints = await readHighEntropy();
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

    const audit: DeviceAudit = {
        at: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
        language: navigator.language || UNKNOWN,
        userAgent: navigator.userAgent || UNKNOWN,
        platform: hints.platform || (navigator as Navigator & { platform?: string }).platform || UNKNOWN,
        osVersion: hints.platformVersion || UNKNOWN,
        // Masaüstü tarayıcılar model bildirmez; bu alan genelde boş kalır.
        model: hints.model ? hints.model : "bildirilmiyor",
        architecture: [hints.architecture, hints.bitness].filter(Boolean).join(" ") || UNKNOWN,
        cpuCores: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : UNKNOWN,
        memoryGb: memory ? `~${memory} GB` : "bildirilmiyor",
        screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
    };

    if (includeIp) audit.ip = await readPublicIp();
    return audit;
}

/** Künyeye yazılacak — ve indirmeden önce ekranda gösterilecek — satırlar. */
export function auditLines(audit: DeviceAudit): string[] {
    const lines = [
        `Tarih: ${audit.at}`,
        `Saat dilimi: ${audit.timezone}`,
        `Dil: ${audit.language}`,
        `İşletim sistemi: ${`${audit.platform} ${audit.osVersion}`.trim()}`,
        `Cihaz modeli: ${audit.model}`,
        `Mimari: ${audit.architecture}`,
        `CPU çekirdek: ${audit.cpuCores}`,
        `Bellek: ${audit.memoryGb}`,
        `Ekran: ${audit.screen}`,
        `Tarayıcı: ${audit.userAgent}`,
    ];
    if (audit.ip) lines.push(`Genel IP: ${audit.ip}`);
    return lines;
}
