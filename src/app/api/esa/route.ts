import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import ESA20240910, * as $ESA20240910 from "@alicloud/esa20240910";
import * as $OpenApi from "@alicloud/openapi-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ESAAccountConfig {
  name: string;
  accessKeyId: string;
  accessKeySecret: string;
  sites?: string[];
}

function parseESAAccounts(): ESAAccountConfig[] {
  const accounts: ESAAccountConfig[] = [];

  const singleId = process.env.ESA_ACCESS_KEY_ID;
  const singleSecret = process.env.ESA_ACCESS_KEY_SECRET;
  const singleSites = process.env.ESA_SITES?.split(",").map((s) => s.trim()).filter(Boolean);
  if (singleId && singleSecret) {
    accounts.push({
      name: process.env.ESA_ACCOUNT_NAME || "Aliyun ESA",
      accessKeyId: singleId,
      accessKeySecret: singleSecret,
      sites: singleSites,
    });
  }

  let i = 1;
  while (process.env[`ESA_ACCESS_KEY_ID_${i}`] && process.env[`ESA_ACCESS_KEY_SECRET_${i}`]) {
    const sites = process.env[`ESA_SITES_${i}`]?.split(",").map((s) => s.trim()).filter(Boolean);
    accounts.push({
      name: process.env[`ESA_ACCOUNT_NAME_${i}`] || `Aliyun ESA ${i}`,
      accessKeyId: process.env[`ESA_ACCESS_KEY_ID_${i}`]!,
      accessKeySecret: process.env[`ESA_ACCESS_KEY_SECRET_${i}`]!,
      sites,
    });
    i++;
  }

  return accounts;
}

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function signParams(params: Record<string, string>, accessKeySecret: string) {
  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
  return signature;
}

async function callEsaApi(
  action: string,
  extraParams: Record<string, string>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    ...extraParams,
  };

  params.Signature = signParams(params, accessKeySecret);
  const query = Object.entries(params)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const res = await fetch(`${endpoint}/?${query}`, { method: "GET" });
  return res.json();
}

async function callEsaApiPost(
  action: string,
  bodyParams: Record<string, any>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const allParams: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: timestamp,
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
  };
  for (const [key, value] of Object.entries(bodyParams)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        allParams[`${key}.${index + 1}`] = String(item);
      });
    } else {
      allParams[key] = String(value);
    }
  }
  const sortedKeys = Object.keys(allParams).sort();
  const canonicalizedQueryString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");
  const stringToSign = `POST&${percentEncode("/")}&${percentEncode(canonicalizedQueryString)}`;
  
  const signature = crypto
    .createHmac("sha1", accessKeySecret + "&")
    .update(stringToSign)
    .digest("base64");

  allParams.Signature = signature;
  const query = Object.entries(allParams)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  console.log("ESA POST Response for", action);
  const res = await fetch(`${endpoint}/?${query}`, { method: "POST" });
  const result = await res.json();
  console.log(JSON.stringify(result, null, 2));
  return result;
}
async function callEsaApiWithArrays(
  action: string,
  simpleParams: Record<string, string>,
  arrayParams: Record<string, string[]>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    ...simpleParams,
  };
  for (const [key, values] of Object.entries(arrayParams)) {
    values.forEach((value, index) => {
      params[`${key}.${index + 1}`] = value;
    });
  }
  console.log(`ESA API params for ${action}:`, JSON.stringify(params, null, 2));

  params.Signature = signParams(params, accessKeySecret);
  const query = Object.entries(params)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  console.log(`ESA API query string: ${query.substring(0, 500)}...`);

  const res = await fetch(`${endpoint}/?${query}`, { method: "GET" });
  return res.json();
}

async function fetchDefaultInstanceId(
  accessKeyId: string,
  accessKeySecret: string
): Promise<string | null> {
  try {
    const resp = await callEsaApi(
      "ListUserRatePlanInstances",
      { PageNumber: "1", PageSize: "10" },
      accessKeyId,
      accessKeySecret
    );
    const instances =
      resp?.Instances ||
      resp?.Result?.Instances ||
      resp?.Data?.Instances ||
      resp?.Instances?.Instances ||
      [];
    if (Array.isArray(instances) && instances.length > 0) {
      return instances[0].InstanceId || instances[0].instanceId || null;
    }
  } catch (err) {
    console.error("ESA ListUserRatePlanInstances error:", err);
  }
  return null;
}

function normalizeSites(raw: any[]): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    SiteId: s.SiteId || s.siteId || s.Id || "",
    SiteName: s.SiteName || s.siteName || s.Name || "",
    Status: s.Status || s.status,
    DomainCount: s.DomainCount || s.domainCount,
    Type: s.Type || s.type,
    Coverage: s.Coverage || s.coverage,
    CnameStatus: s.CnameStatus || s.cnameStatus,
    Area: s.Area || s.area,
    AccessType: s.AccessType || s.accessType,
  }));
}

function normalizeQuotas(raw: any[]): { quotaName: string; total: number; used: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q) => ({
    quotaName: q.QuotaName || q.quotaName || q.Name || "",
    total: Number(q.Total || q.total || q.Quota || q.quota || q.QuotaValue || 0),
    used: Number(q.Used || q.used || q.Usage || q.usage || 0),
  }));
}

interface ESARoutine {
  name: string;
  description?: string;
  codeVersion?: string;
  status?: string;
  createTime?: string;
  updateTime?: string;
}

function normalizeRoutines(raw: any[]): ESARoutine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    name: r.Name || r.name || r.RoutineName || "",
    description: r.Description || r.description || "",
    codeVersion: r.CodeVersion || r.codeVersion || "",
    status: r.Status || r.status || "",
    createTime: r.CreateTime || r.createTime || "",
    updateTime: r.UpdateTime || r.updateTime || "",
  }));
}

async function fetchRoutines(
  accessKeyId: string,
  accessKeySecret: string
): Promise<{ routines: ESARoutine[]; totalCount: number }> {
  try {
    const resp = await callEsaApi(
      "ListUserRoutines",
      { PageNumber: "1", PageSize: "50" },
      accessKeyId,
      accessKeySecret
    );
    const routinesRaw =
      resp?.Routines ||
      resp?.Result?.Routines ||
      resp?.Data?.Routines ||
      resp?.Routines?.Routine ||
      [];
    const totalCount = resp?.TotalCount || resp?.Result?.TotalCount || routinesRaw.length || 0;
    return { routines: normalizeRoutines(routinesRaw), totalCount };
  } catch (err) {
    console.error("ESA ListUserRoutines error:", err);
    return { routines: [], totalCount: 0 };
  }
}

async function fetchEdgeRoutinePlans(
  accessKeyId: string,
  accessKeySecret: string
): Promise<any[]> {
  try {
    const resp = await callEsaApi(
      "ListEdgeRoutinePlans",
      {},
      accessKeyId,
      accessKeySecret
    );
    return resp?.Plans || resp?.Result?.Plans || resp?.Data?.Plans || [];
  } catch (err) {
    console.error("ESA ListEdgeRoutinePlans error:", err);
    return [];
  }
}

async function fetchErService(
  accessKeyId: string,
  accessKeySecret: string
): Promise<any> {
  try {
    const resp = await callEsaApi(
      "GetErService",
      {},
      accessKeyId,
      accessKeySecret
    );
    return resp || {};
  } catch (err) {
    console.error("ESA GetErService error:", err);
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const accounts = parseESAAccounts();
    if (accounts.length === 0) {
      return NextResponse.json({ error: "请配置 ESA_ACCESS_KEY_ID 与 ESA_ACCESS_KEY_SECRET", accounts: [] });
    }
    const quotaNames = [
      "customHttpCert",
      "transition_rule",
      "waiting_room",
      "https|rule_quota",
      "cache_rules|rule_quota",
      "configuration_rules|rule_quota",
      "redirect_rules|rule_quota",
      "compression_rules|rule_quota",
      "origin_rules|rule_quota",
      "ratelimit_rules|rule_quota",
      "waf_rules|rule_quota",
      "edge_routine|rule_quota",
      "page_rules|rule_quota",
      "origin_rules|rule_quota",
      "ssl_certificates",
      "custom_pages",
      "log_delivery_tasks",
      "custom_log_fields",
    ];

    const payload: {
      accounts: {
        name: string;
        sites: any[];
        quotas: { quotaName: string; total: number; used: number }[];
        totalRequests: number;
        totalBytes: number;
        instanceId?: string;
        quotaSource?: string;
        routines?: ESARoutine[];
        routineCount?: number;
        edgeRoutinePlans?: any[];
        erService?: any;
      }[];
    } = { accounts: [] };

    for (const acc of accounts) {
      // List sites
      const siteRes = await callEsaApi("ListSites", {}, acc.accessKeyId, acc.accessKeySecret);
      const sitesRaw =
        siteRes?.Sites ||
        siteRes?.sites ||
        siteRes?.Result?.Sites ||
        siteRes?.Result?.sites ||
        siteRes?.Data?.Sites ||
        siteRes?.Sites?.Site ||
        siteRes?.Result?.Sites?.Site ||
        siteRes?.Data?.Sites?.Site ||
        [];
      let sites = normalizeSites(sitesRaw);
      if (acc.sites && acc.sites.length > 0) {
        const set = new Set(acc.sites.map((s) => s.toLowerCase()));
        sites = sites.filter((s) => set.has((s.SiteName || "").toLowerCase()) || set.has((s.SiteId || "").toLowerCase()));
      }
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
      const endTime = now.toISOString().replace(/\.\d{3}Z$/, "Z");
      
      try {
        const config = new $OpenApi.Config({
          accessKeyId: acc.accessKeyId,
          accessKeySecret: acc.accessKeySecret,
          endpoint: "esa.cn-hangzhou.aliyuncs.com",
        });
        const client = new ESA20240910(config);
        
        for (const site of sites) {
          if (site.SiteId) {
            try {
              // Fields must be array of objects with fieldName property
              const request = new $ESA20240910.DescribeSiteTimeSeriesDataRequest({
                siteId: Number(site.SiteId),
                startTime: startTime,
                endTime: endTime,
                fields: [
                  new $ESA20240910.DescribeSiteTimeSeriesDataRequestFields({ fieldName: "Traffic" }),
                  new $ESA20240910.DescribeSiteTimeSeriesDataRequestFields({ fieldName: "Requests" }),
                ],
              });
              
              console.log("ESA SDK Request:", JSON.stringify(request, null, 2));
              const response = await client.describeSiteTimeSeriesData(request);
              console.log("ESA SDK Response:", JSON.stringify(response.body, null, 2));
              
              let totalRequests = 0;
              let totalBytes = 0;
              
              // Parse SummarizedData
              const summaryData = response.body?.summarizedData || [];
              for (const item of summaryData) {
                const fieldName = item.fieldName || "";
                if (fieldName === "Requests") {
                  totalRequests += Number(item.value || 0);
                }
                if (fieldName === "Traffic") {
                  totalBytes += Number(item.value || 0);
                }
              }
              
              site.requests = totalRequests;
              site.bytes = totalBytes;
            } catch (err: any) {
              console.error(`ESA SDK error for ${site.SiteId}:`, err?.message || err);
            }
          }
        }
      } catch (sdkErr: any) {
        console.error("ESA SDK init error:", sdkErr?.message || sdkErr);
      }
      let quotas: { quotaName: string; total: number; used: number }[] = [];
      let instanceId =
        sitesRaw?.[0]?.InstanceId ||
        sitesRaw?.[0]?.instanceId ||
        sites?.[0]?.InstanceId ||
        sites?.[0]?.instanceId ||
        (await fetchDefaultInstanceId(acc.accessKeyId, acc.accessKeySecret));
      const firstSiteId = sites?.[0]?.SiteId || sitesRaw?.[0]?.SiteId || sitesRaw?.[0]?.siteId;
      let quotaRes: any = undefined;
      let quotaResSiteOnly: any = undefined;
      let quotaResFallback: any = undefined;

      if (instanceId) {
        // Prefer instance + site binding; fallback to instance only
        quotaRes = await callEsaApi(
          "ListInstanceQuotasWithUsage",
          {
            ...(firstSiteId ? { InstanceId: instanceId, SiteId: String(firstSiteId) } : { InstanceId: instanceId }),
            ...(quotaNames && quotaNames.length > 0 ? { QuotaNames: quotaNames.join(",") } : {}),
          },
          acc.accessKeyId,
          acc.accessKeySecret
        );
        const quotasRaw =
          quotaRes?.InstanceQuotas ||
          quotaRes?.Quotas ||
          quotaRes?.QuotaUsages ||
          quotaRes?.Data?.InstanceQuotas ||
          quotaRes?.Quotas?.Quotas ||
          quotaRes?.Quotas?.Quota ||
          quotaRes?.Data?.Quotas ||
          [];
        quotas = normalizeQuotas(quotasRaw);
        if (quotas.length === 0 && firstSiteId) {
          quotaResSiteOnly = await callEsaApi(
            "ListInstanceQuotasWithUsage",
            {
              SiteId: String(firstSiteId),
              ...(quotaNames && quotaNames.length > 0 ? { QuotaNames: quotaNames.join(",") } : {}),
            },
            acc.accessKeyId,
            acc.accessKeySecret
          );
          const quotasRaw2 =
            quotaResSiteOnly?.InstanceQuotas ||
            quotaResSiteOnly?.Quotas ||
            quotaResSiteOnly?.QuotaUsages ||
            quotaResSiteOnly?.Data?.InstanceQuotas ||
            quotaResSiteOnly?.Quotas?.Quotas ||
            quotaResSiteOnly?.Quotas?.Quota ||
            quotaResSiteOnly?.Data?.Quotas ||
            [];
          quotas = normalizeQuotas(quotasRaw2);
        }
        if (quotas.length === 0) {
          const fallbackInstanceId = await fetchDefaultInstanceId(acc.accessKeyId, acc.accessKeySecret);
          if (fallbackInstanceId && fallbackInstanceId !== instanceId) {
            instanceId = fallbackInstanceId;
            quotaResFallback = await callEsaApi(
              "ListInstanceQuotasWithUsage",
              {
                InstanceId: fallbackInstanceId,
                ...(quotaNames && quotaNames.length > 0 ? { QuotaNames: quotaNames.join(",") } : {}),
              },
              acc.accessKeyId,
              acc.accessKeySecret
            );
            const quotasRaw3 =
              quotaResFallback?.InstanceQuotas ||
              quotaResFallback?.Quotas ||
              quotaResFallback?.QuotaUsages ||
              quotaResFallback?.Data?.InstanceQuotas ||
              quotaResFallback?.Quotas?.Quotas ||
              quotaResFallback?.Quotas?.Quota ||
              quotaResFallback?.Data?.Quotas ||
              [];
            quotas = normalizeQuotas(quotasRaw3);
          }
        }
      }
      const { routines, totalCount: routineCount } = await fetchRoutines(acc.accessKeyId, acc.accessKeySecret);
      const edgeRoutinePlans = await fetchEdgeRoutinePlans(acc.accessKeyId, acc.accessKeySecret);
      const erService = await fetchErService(acc.accessKeyId, acc.accessKeySecret);
      const totalRequests = sites.reduce((sum, s) => sum + (s.requests || 0), 0);
      const totalBytes = sites.reduce((sum, s) => sum + (s.bytes || 0), 0);

      payload.accounts.push({
        name: acc.name,
        sites: sites.slice(0, 20),
        quotas,
        totalRequests,
        totalBytes,
        instanceId,
        quotaSource: instanceId ? "instance" : "fallback",
        routines: routines.slice(0, 20),
        routineCount,
        edgeRoutinePlans,
        erService,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("ESA API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
