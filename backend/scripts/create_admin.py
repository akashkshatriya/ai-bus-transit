import sys
import argparse
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def main():
    parser = argparse.ArgumentParser(
        description="Create an admin account for the Bus Tracking system."
    )
    parser.add_argument("name", help="Full name of the admin")
    parser.add_argument("email", help="Email address of the admin")
    parser.add_argument("password", help="Password for the admin account (minimum 12 characters)")

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

    if len(password) < 12:
        print(f"Error: Password must be at least 12 characters long (got {len(password)}).", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        # Refuse if an admin already exists (there is exactly ONE admin)
        existing_admin = db.query(User).filter(User.role == "admin").first()
        if existing_admin:
            print("Error: An admin account already exists. Only one admin is allowed.", file=sys.stderr)
            sys.exit(1)

        # Refuse if the e-mail already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"Error: User with email '{email}' already exists.", file=sys.stderr)
            sys.exit(1)

        new_admin = User(
            name=name,
            email=email,
            hashed_password=get_password_hash(password),
            role="admin"
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)

        print(f"Success: Admin account created successfully for '{new_admin.name}' ({new_admin.email}) with role '{new_admin.role}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

