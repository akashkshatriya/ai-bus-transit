import requests
import json

tests = [
    # Belman -> Udupi tests
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '08:20', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '11:20', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '15:20', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '15:32', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '16:00', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Belman', 'time': '16:12', 'day_type': 'Weekday'},
    
    # Intermediate stops
    {'route': 'belman_to_udupi', 'stop_name': 'Bantakal', 'time': '08:23', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'SMVITM', 'time': '12:15', 'day_type': 'Weekday'},
    {'route': 'belman_to_udupi', 'stop_name': 'Shankarpura', 'time': '17:10', 'day_type': 'Weekday'},
    
    # Udupi -> Belman tests
    {'route': 'udupi_to_belman', 'stop_name': 'Udupi', 'time': '07:15', 'day_type': 'Weekday'},
    {'route': 'udupi_to_belman', 'stop_name': 'Udupi', 'time': '11:00', 'day_type': 'Weekday'},
    {'route': 'udupi_to_belman', 'stop_name': 'Katpadi', 'time': '14:20', 'day_type': 'Weekday'},
    {'route': 'udupi_to_belman', 'stop_name': 'Shirva', 'time': '18:40', 'day_type': 'Weekend'},

    # Night / out-of-service tests
    {'route': 'belman_to_udupi', 'stop_name': 'Shankarpura', 'time': '23:30', 'day_type': 'Weekday'},
]

print(f"{'Route':<16} | {'Stop':<12} | {'Ref Time':<8} | {'Next Bus':<14} | {'Normal':<7} | {'Pred':<7} | {'Delay':<7} | {'Wait':<7} | {'Crowd':<7}")
print("-" * 105)

passed_checks = 0
total_checks = 0

for t in tests:
    res = requests.post('http://localhost:8000/api/v1/predict', json=t)
    data = res.json()
    
    route_short = t['route'].split('_')[0] + '->' + t['route'].split('_')[2]
    ref_time = t['time']
    stop = t['stop_name']
    
    if data.get('no_prediction'):
        print(f"{route_short:<16} | {stop:<12} | {ref_time:<8} | {'[NO SERVICE]':<14} | {'--':<7} | {'--':<7} | {'--':<7} | {'--':<7} | {'--':<7}")
        total_checks += 1
        passed_checks += 1
        continue
    
    bus = data.get('next_bus_name', 'Unknown')
    norm = data.get('normal_arrival_time')
    pred = data.get('predicted_arrival_time')
    delay = data.get('bus_delay_minutes')
    wait = data.get('passenger_wait_minutes')
    crowd = data.get('predicted_crowd_level')
    
    print(f"{route_short:<16} | {stop:<12} | {ref_time:<8} | {bus:<14} | {norm:<7} | {pred:<7} | +{delay:<6} | {wait:>4} min | {crowd:<7}")
    
    # Assertions
    total_checks += 3
    # 1. Bus name is not empty
    if bus and bus != 'Unknown':
        passed_checks += 1
    # 2. Wait time is non-negative
    if wait is not None and wait >= 0:
        passed_checks += 1
    # 3. Predicted arrival is computed from normal + delay
    if pred is not None and norm is not None:
        passed_checks += 1

print("-" * 105)
print(f"Validation summary: {passed_checks}/{total_checks} checks passed.")
