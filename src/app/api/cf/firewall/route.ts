import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
parseAccountConfigs 解析 Cloudflare 账户配置
@功能 从环境变量中读取单账户或多账户配置
@return 账户配置数组
*/
interface AccountConfig {
  name: string;
  apiKey: string;
  email: string;
}

function parseAccountConfigs(): AccountConfig[] {
  const accounts: AccountConfig[] = [];
  const singleApiKey = process.env.CF_API_KEY;
  const singleEmail = process.env.CF_EMAIL;
  if (singleApiKey && singleEmail) {
    accounts.push({
      name: process.env.CF_ACCOUNT_NAME || "默认账户",
      apiKey: singleApiKey,
      email: singleEmail,
    });
  }
  let i = 1;
  while (process.env[`CF_API_KEY_${i}`] && process.env[`CF_EMAIL_${i}`]) {
    accounts.push({
      name: process.env[`CF_ACCOUNT_NAME_${i}`] || `账户 ${i}`,
      apiKey: process.env[`CF_API_KEY_${i}`]!,
      email: process.env[`CF_EMAIL_${i}`]!,
    });
    i++;
  }
  return accounts;
}

/*
fetchFirewallEvents 获取 Cloudflare 防火墙事件数据
@功能 通过 GraphQL API 获取指定 zone 的防火墙事件汇总（按 action、source、country 等维度）
@param headers 认证头
@param zoneId 站点 ID
@param since 开始时间
@param until 结束时间
@return 防火墙事件汇总数据
*/
async function fetchFirewallEvents(
  headers: Record<string, string>,
  zoneId: string,
  since: string,
  until: string
) {
  const query = `
    query($zone: String!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          firewallEventsAdaptiveGroups(
            filter: {datetime_geq: $since, datetime_leq: $until}
            limit: 100
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              action
              source
              clientCountryName
              clientIP
              clientRequestHTTPHost
              clientRequestPath
              ruleId
            }
          }
        }
      }
    }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { zone: zoneId, since, until },
      }),
    });
    const data = await res.json();
    return data.data?.viewer?.zones?.[0]?.firewallEventsAdaptiveGroups || [];
  } catch (error) {
    console.error("Firewall events fetch error:", error);
    return [];
  }
}

/*
fetchAllZoneIds 获取该账户下所有 zone 的 ID 和域名
@功能 通过 REST API 获取账户下所有站点列表
*/
async function fetchAllZoneIds(headers: Record<string, string>) {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
      headers,
    });
    const data = await res.json();
    return (data.result || []).map((z: { id: string; name: string }) => ({
      id: z.id,
      name: z.name,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountConfigs = parseAccountConfigs();
    if (accountConfigs.length === 0) {
      return NextResponse.json({ error: "请配置 CF_API_KEY 和 CF_EMAIL", accounts: [] });
    }

    const { searchParams } = new URL(request.url);
    const targetDomain = searchParams.get("domain");

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since = yesterday.toISOString();
    const until = now.toISOString();

    const allAccounts: {
      account: string;
      zones: {
        domain: string;
        events: {
          byAction: { action: string; count: number }[];
          bySource: { source: string; count: number }[];
          byCountry: { country: string; count: number }[];
          byIP: { ip: string; count: number }[];
          byHost: { host: string; count: number }[];
          byPath: { path: string; count: number }[];
          totalEvents: number;
        };
      }[];
    }[] = [];

    for (const config of accountConfigs) {
      const headers = {
        "X-Auth-Key": config.apiKey,
        "X-Auth-Email": config.email,
        "Content-Type": "application/json",
      };

      const zones = await fetchAllZoneIds(headers);
      const filteredZones = targetDomain
        ? zones.filter((z: { name: string }) => z.name === targetDomain)
        : zones.slice(0, 10);

      const accountData: typeof allAccounts[number] = {
        account: config.name,
        zones: [],
      };

      for (const zone of filteredZones) {
        const rawEvents = await fetchFirewallEvents(headers, zone.id, since, until);

        /* 按各维度聚合防火墙事件 */
        const actionMap: Record<string, number> = {};
        const sourceMap: Record<string, number> = {};
        const countryMap: Record<string, number> = {};
        const ipMap: Record<string, number> = {};
        const hostMap: Record<string, number> = {};
        const pathMap: Record<string, number> = {};
        let totalEvents = 0;

        rawEvents.forEach((e: any) => {
          const count = e.count || 0;
          totalEvents += count;
          const d = e.dimensions || {};

          if (d.action) {
            actionMap[d.action] = (actionMap[d.action] || 0) + count;
          }
          if (d.source) {
            sourceMap[d.source] = (sourceMap[d.source] || 0) + count;
          }
          if (d.clientCountryName) {
            countryMap[d.clientCountryName] = (countryMap[d.clientCountryName] || 0) + count;
          }
          if (d.clientIP) {
            ipMap[d.clientIP] = (ipMap[d.clientIP] || 0) + count;
          }
          if (d.clientRequestHTTPHost) {
            hostMap[d.clientRequestHTTPHost] = (hostMap[d.clientRequestHTTPHost] || 0) + count;
          }
          if (d.clientRequestPath) {
            pathMap[d.clientRequestPath] = (pathMap[d.clientRequestPath] || 0) + count;
          }
        });

        const toSorted = (map: Record<string, number>, key: string) =>
          Object.entries(map)
            .map(([k, v]) => ({ [key]: k, count: v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        accountData.zones.push({
          domain: zone.name,
          events: {
            byAction: toSorted(actionMap, "action") as { action: string; count: number }[],
            bySource: toSorted(sourceMap, "source") as { source: string; count: number }[],
            byCountry: toSorted(countryMap, "country") as { country: string; count: number }[],
            byIP: toSorted(ipMap, "ip") as { ip: string; count: number }[],
            byHost: toSorted(hostMap, "host") as { host: string; count: number }[],
            byPath: toSorted(pathMap, "path") as { path: string; count: number }[],
            totalEvents,
          },
        });
      }

      allAccounts.push(accountData);
    }

    return NextResponse.json({ accounts: allAccounts });
  } catch (error) {
    console.error("CF Firewall API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
