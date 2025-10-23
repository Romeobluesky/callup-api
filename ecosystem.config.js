module.exports = {
  apps: [
    // 프로덕션 모드 (빌드 필요)
    {
      name: "callup-api",
      script: "npm",
      args: "start",
      cwd: "/home/callup-api",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3020
      },
      error_file: "/home/callup-api/logs/err.log",
      out_file: "/home/callup-api/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },

    // 개발 모드 (빌드 불필요) - 주석 처리됨
    // {
    //   name: "callup-api-dev",
    //   script: "npm",
    //   args: "run dev",
    //   cwd: "/home/callup-api",
    //   instances: 1,
    //   exec_mode: "fork",
    //   env: {
    //     NODE_ENV: "development",
    //     PORT: 3000
    //   },
    //   error_file: "/home/callup-api/logs/err.log",
    //   out_file: "/home/callup-api/logs/out.log",
    //   log_date_format: "YYYY-MM-DD HH:mm:ss"
    // }
  ]
}