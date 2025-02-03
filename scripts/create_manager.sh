curl -X POST http://localhost:8080/actors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer env_svc.eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.CJvM1--uQBCbpNHUzDIaEgoQ3UK_Fj0CTAuHiBR438gfGCIXmgEUChIKELwDPXXvmkQOqe1g3mSKQIc.vVdpsxjeZfIybCMI6wykAK9MfEZiNmw6i6uZoD2x0DyH8_42K1-QfPH-6xo2EmVlhSKAxri6AilcZrzyXlk0CQ" \
  -d '{
    "tags": { "name": "manager", "owner": "rivet" },
    "build": "b9bc242c-9594-44d9-945a-4964ccb7da26",
    "runtime": {
      "environment": {
        "RIVET_SERVICE_TOKEN": "env_svc.eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.CJvM1--uQBCbpNHUzDIaEgoQ3UK_Fj0CTAuHiBR438gfGCIXmgEUChIKELwDPXXvmkQOqe1g3mSKQIc.vVdpsxjeZfIybCMI6wykAK9MfEZiNmw6i6uZoD2x0DyH8_42K1-QfPH-6xo2EmVlhSKAxri6AilcZrzyXlk0CQ"
      }
    },
    "network": {
      "mode": "bridge",
      "ports": {
        "http": {
          "protocol": "https",
          "routing": {
            "guard": {}
          }
        }
      }
    },
    "lifecycle": {
      "durable": true
    }
  }'
