curl -X POST http://localhost:3000/v1/users \
-H "Content-Type: application/json" \
-H "x-api-key: neocard_admin_demo_key_2024" \
-d '{
  "first_name":"Kev",
  "last_name":"Kel",
  "email":"kev.kel@example.com",
  "phone":"+254700111111"
}'



curl -X POST http://localhost:3000/v1/hardware/assign \
-H "Content-Type: application/json" \
-H "x-api-key: neocard_admin_demo_key_2024" \
-d '{
  "user_id":"user_1784055628338_77a5c1e4",
  "device_id":"device_1783962666378_8d478192"
}'



Enrollment ID : ENR-PI-003
User ID       : user_1784055628338_77a5c1e4
Fingerprint Slot : 3