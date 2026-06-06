import { getProductionSafetyFindings } from './production-guard';

describe('production guard', () => {
  it('does not report findings outside production', () => {
    expect(getProductionSafetyFindings({ NODE_ENV: 'development' } as any)).toEqual([]);
  });

  it('fails production when the master token is weak', () => {
    const findings = getProductionSafetyFindings({
      NODE_ENV: 'production',
      CANVAS_FLOW_API_TOKEN: 'short',
      CORS_ORIGINS: 'https://app.example.com',
    } as any);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'fail', code: 'missing_api_token' }),
    ]));
  });

  it('fails production wildcard CORS and weak JWT when login is enabled', () => {
    const findings = getProductionSafetyFindings({
      NODE_ENV: 'production',
      CANVAS_FLOW_API_TOKEN: 'a'.repeat(40),
      CANVAS_FLOW_LOGIN: 'true',
      CANVAS_FLOW_JWT_SECRET: 'weak',
      CORS_ORIGINS: '*',
    } as any);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'fail', code: 'missing_jwt_secret' }),
      expect.objectContaining({ level: 'fail', code: 'cors_wildcard' }),
    ]));
  });

  it('warns when production login is disabled', () => {
    const findings = getProductionSafetyFindings({
      NODE_ENV: 'production',
      CANVAS_FLOW_API_TOKEN: 'a'.repeat(40),
      CORS_ORIGINS: 'https://app.example.com',
    } as any);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'warn', code: 'login_disabled' }),
    ]));
    expect(findings.some((finding) => finding.level === 'fail')).toBe(false);
  });

  it('fails production when S3 document storage has no bucket', () => {
    const findings = getProductionSafetyFindings({
      NODE_ENV: 'production',
      CANVAS_FLOW_API_TOKEN: 'a'.repeat(40),
      CORS_ORIGINS: 'https://app.example.com',
      CANVAS_FLOW_FILES_STORAGE: 's3',
    } as any);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'fail', code: 'missing_files_s3_bucket' }),
    ]));
  });
});
