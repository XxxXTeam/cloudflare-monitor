import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AccountConfig {
  name: string;
  apiKey: string;
  email: string;
  accountId?: string;
}

function parseAccountConfigs(): AccountConfig[] {
  const accounts: AccountConfig[] = [];

  const singleApiKey = process.env.CF_API_KEY;
  const singleEmail = process.env.CF_EMAIL;
  const singleAccountId = process.env.CF_ACCOUNT_ID;

  if (singleApiKey && singleEmail) {
    accounts.push({
      name: process.env.CF_ACCOUNT_NAME || "默认账户",
      apiKey: singleApiKey,
      email: singleEmail,
      accountId: singleAccountId,
    });
  }

  let i = 1;
  while (process.env[`CF_API_KEY_${i}`] && process.env[`CF_EMAIL_${i}`]) {
    accounts.push({
      name: process.env[`CF_ACCOUNT_NAME_${i}`] || `账户 ${i}`,
      apiKey: process.env[`CF_API_KEY_${i}`]!,
      email: process.env[`CF_EMAIL_${i}`]!,
      accountId: process.env[`CF_ACCOUNT_ID_${i}`],
    });
    i++;
  }

  return accounts;
}

async function fetchAccountId(headers: HeadersInit): Promise<string | null> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=1", {
      headers,
    });
    const data = await res.json();
    return data.result?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function fetchPagesProjects(headers: HeadersInit, accountId: string) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
      headers,
    });
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

async function fetchPagesBuildStats(headers: HeadersInit, accountId: string) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  // Fetch deployments to count builds
  try {
    const projects = await fetchPagesProjects(headers, accountId);
    
    let todayBuilds = 0;
    let monthBuilds = 0;
    const projectStats: { name: string; todayBuilds: number; monthBuilds: number }[] = [];

    for (const project of projects.slice(0, 10)) { // Limit to 10 projects
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project.name}/deployments?per_page=100`,
        { headers }
      );
      const data = await res.json();
      const deployments = data.result || [];

      let projectTodayBuilds = 0;
      let projectMonthBuilds = 0;

      deployments.forEach((d: any) => {
        const createdAt = d.created_on?.slice(0, 10);
        if (createdAt === todayStr) {
          projectTodayBuilds++;
          todayBuilds++;
        }
        if (createdAt >= monthStart) {
          projectMonthBuilds++;
          monthBuilds++;
        }
      });

      projectStats.push({
        name: project.name,
        todayBuilds: projectTodayBuilds,
        monthBuilds: projectMonthBuilds,
      });
    }

    return {
      todayBuilds,
      monthBuilds,
      projectCount: projects.length,
      projects: projectStats,
    };
  } catch (error) {
    console.error("Pages build stats error:", error);
    return {
      todayBuilds: 0,
      monthBuilds: 0,
      projectCount: 0,
      projects: [],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountConfigs = parseAccountConfigs();

    if (accountConfigs.length === 0) {
      return NextResponse.json({ error: "请配置 CF_API_KEY 和 CF_EMAIL", accounts: [] });
    }

    const allStats: { account: string; stats: any }[] = [];

    for (const config of accountConfigs) {
      const headers = {
        "X-Auth-Key": config.apiKey,
        "X-Auth-Email": config.email,
        "Content-Type": "application/json",
      };

      let accountId: string | undefined = config.accountId;
      if (!accountId) {
        const fetchedId = await fetchAccountId(headers);
        if (fetchedId) accountId = fetchedId;
      }

      if (!accountId) {
        continue;
      }

      const stats = await fetchPagesBuildStats(headers, accountId);
      allStats.push({
        account: config.name,
        stats,
      });
    }

    // Aggregate totals
    const totals = {
      todayBuilds: allStats.reduce((sum, a) => sum + a.stats.todayBuilds, 0),
      monthBuilds: allStats.reduce((sum, a) => sum + a.stats.monthBuilds, 0),
      projectCount: allStats.reduce((sum, a) => sum + a.stats.projectCount, 0),
    };

    return NextResponse.json({
      accounts: allStats,
      totals,
    });
  } catch (error) {
    console.error("CF Pages API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
