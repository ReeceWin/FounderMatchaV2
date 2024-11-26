import firebase_admin
from firebase_admin import credentials, firestore
import random
import argparse
import logging

# Set up logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FirebaseUpdater:
    def __init__(self, cred_path: str):
        """Initialize Firebase connection"""
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            logger.info("Successfully connected to Firebase")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            raise

    def get_all_users(self):
        """Retrieve all users from the database"""
        try:
            users_ref = self.db.collection('hackathonusers')
            docs = users_ref.stream()
            return [(doc.id, doc.to_dict()) for doc in docs]
        except Exception as e:
            logger.error(f"Failed to retrieve users: {e}")
            return []

    def generate_random_work_styles(self):
        """Generate a random set of work style preferences"""
        styles = ['Remote', 'Hybrid', 'On-site']
        # Generate 1-3 random preferences
        num_preferences = random.randint(1, 3)
        return sorted(random.sample(styles, num_preferences))

    def update_work_preferences(self, demo_mode: bool = False):
        """Update work style preferences for all users"""
        users = self.get_all_users()
        updated_count = 0
        failed_count = 0

        for user_id, user_data in users:
            try:
                # Skip if work styles already exist and we're not in demo mode
                if not demo_mode and 'workStyles' in user_data:
                    logger.info(f"Skipping user {user_id}: work styles already exist")
                    continue

                # Prepare update data
                update_data = {}

                if demo_mode or 'workStyles' not in user_data:
                    # Both founders and developers get an array of preferences
                    update_data['workStyles'] = self.generate_random_work_styles()

                # Only update if we have data to update
                if update_data:
                    self.db.collection('hackathonusers').document(user_id).update(update_data)
                    logger.info(f"Updated user {user_id} with work styles: {update_data.get('workStyles')}")
                    updated_count += 1

            except Exception as e:
                logger.error(f"Failed to update user {user_id}: {e}")
                failed_count += 1

        return {
            'updated': updated_count,
            'failed': failed_count,
            'total': len(users)
        }

    def update_single_user(self, user_id: str, work_styles: list):
        """Update work styles for a single user"""
        try:
            valid_styles = {'Remote', 'Hybrid', 'On-site'}
            # Validate work styles
            if not all(style in valid_styles for style in work_styles):
                raise ValueError("Invalid work style. Must be 'Remote', 'Hybrid', or 'On-site'")

            user_ref = self.db.collection('hackathonusers').document(user_id)
            user_ref.update({'workStyles': sorted(work_styles)})
            logger.info(f"Successfully updated user {user_id} with work styles: {work_styles}")
            return True
        except Exception as e:
            logger.error(f"Failed to update user {user_id}: {e}")
            return False

    def display_current_status(self):
        """Display current work style distribution"""
        users = self.get_all_users()

        # Track combinations of work styles
        style_combinations = {
            'Remote only': 0,
            'Hybrid only': 0,
            'On-site only': 0,
            'Remote & Hybrid': 0,
            'Hybrid & On-site': 0,
            'Remote & On-site': 0,
            'All styles': 0,
            'Not Set': 0
        }

        developer_count = 0
        founder_count = 0

        for _, user_data in users:
            role = user_data.get('role', '').lower()
            styles = set(user_data.get('workStyles', []))

            # Count by role
            if role == 'softwareengineer':
                developer_count += 1
            elif role == 'founder / entrepreneur':
                founder_count += 1

            # Categorize work style combination
            if not styles:
                style_combinations['Not Set'] += 1
            elif styles == {'Remote', 'Hybrid', 'On-site'}:
                style_combinations['All styles'] += 1
            elif styles == {'Remote'}:
                style_combinations['Remote only'] += 1
            elif styles == {'Hybrid'}:
                style_combinations['Hybrid only'] += 1
            elif styles == {'On-site'}:
                style_combinations['On-site only'] += 1
            elif styles == {'Remote', 'Hybrid'}:
                style_combinations['Remote & Hybrid'] += 1
            elif styles == {'Hybrid', 'On-site'}:
                style_combinations['Hybrid & On-site'] += 1
            elif styles == {'Remote', 'On-site'}:
                style_combinations['Remote & On-site'] += 1

        # Display results
        logger.info("\nWork Style Distribution:")
        logger.info(f"Total Users: {len(users)} (Developers: {developer_count}, Founders: {founder_count})")
        for combination, count in style_combinations.items():
            percentage = (count / len(users)) * 100 if len(users) > 0 else 0
            logger.info(f"{combination}: {count} users ({percentage:.1f}%)")


def main():
    parser = argparse.ArgumentParser(description='Update Firebase database with work style preferences')
    parser.add_argument('--cred-path', type=str, default='firebase-credentials.json',
                        help='Path to Firebase credentials JSON file')
    parser.add_argument('--demo', action='store_true',
                        help='Run in demo mode (overwrites existing data with random values)')
    parser.add_argument('--status', action='store_true',
                        help='Display current work style distribution without making changes')
    parser.add_argument('--user-id', type=str,
                        help='Update a specific user ID')
    parser.add_argument('--work-styles', nargs='+',
                        choices=['Remote', 'Hybrid', 'On-site'],
                        help='Work styles to set for the specific user (can specify multiple)')

    args = parser.parse_args()

    try:
        updater = FirebaseUpdater(args.cred_path)

        if args.status:
            updater.display_current_status()
            return

        if args.user_id and args.work_styles:
            # Update single user
            success = updater.update_single_user(args.user_id, args.work_styles)
            if success:
                logger.info("Single user update completed successfully")
            else:
                logger.error("Single user update failed")
            return

        # Perform the bulk update
        logger.info("Starting database update...")
        result = updater.update_work_preferences(demo_mode=args.demo)

        # Display results
        logger.info("\nUpdate Complete!")
        logger.info(f"Total users processed: {result['total']}")
        logger.info(f"Successfully updated: {result['updated']}")
        logger.info(f"Failed updates: {result['failed']}")

        # Show final distribution
        updater.display_current_status()

    except Exception as e:
        logger.error(f"Script failed: {e}")
        raise


if __name__ == "__main__":
    main()