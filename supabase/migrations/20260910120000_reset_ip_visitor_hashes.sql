-- Clear hashes created while the visitor HMAC secret was being initialized.
truncate table private.site_visitor_ips;
