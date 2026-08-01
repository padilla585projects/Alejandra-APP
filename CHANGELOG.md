# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- CI independiente, workflows manuales de Pages/Workers y migración D1 controlada del agente.
- Runbook de CI/CD y migraciones.
- Registro operativo de F-0.1 en `TASKS.md`, incluida la migración 008 sin ejecutar.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- Sin cambios funcionales, de datos ni despliegues.
