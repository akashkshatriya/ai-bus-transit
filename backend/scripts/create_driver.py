import sys
import argparse
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def main():
    parser = argparse.ArgumentParser(
        description="Create a driver account for the Bus Tracking system."
    )
    parser.add_argument("name", help="Full name of the driver")
    parser.add_argument("email", help="Email address of the driver")
    parser.add_argument("password", help="Password for the driver account (minimum 8 characters)")

    args = parser.parse_args()

    name = args.name.strip()
    email = args.email.lower().strip()
    password = args.password

    if not name:
        print("Error: Name cannot be empty.", file=sys.stderr)
        sys.exit(1)

    if not email:
        print("Error: Email cannot be empty.", file=sys.stderr)
        sys.exit(1)

    if len(password) < 8:
        print(f"Error: Password must be at least 8 characters long (got {len(password)}).", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"Error: User with email '{email}' already exists.", file=sys.stderr)
            sys.exit(1)

        new_driver = User(
            name=name,
            email=email,
            hashed_password=get_password_hash(password),
            role="driver"
        )
        db.add(new_driver)
        db.commit()
        db.refresh(new_driver)

        print(f"Success: Driver account created successfully for '{new_driver.name}' ({new_driver.email}) with role '{new_driver.role}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

