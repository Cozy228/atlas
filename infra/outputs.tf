output "portal_alb_dns_name" {
  value       = aws_lb.portal.dns_name
  description = "DNS name of the Atlas public Application Load Balancer."
}

output "feedback_table_name" {
  value       = aws_dynamodb_table.feedback.name
  description = "DynamoDB table used by the Context Layer feedback repository."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.atlas.name
  description = "ECS cluster running the Atlas portal service."
}

output "valkey_endpoint" {
  value       = "${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:${aws_elasticache_serverless_cache.valkey.endpoint[0].port}"
  description = "ElastiCache Serverless (Valkey) endpoint shared by the content cache and session store."
}

output "session_secret_name" {
  value       = aws_secretsmanager_secret.session.name
  description = "Secrets Manager secret holding the session signing key and Entra client certificate."
}
