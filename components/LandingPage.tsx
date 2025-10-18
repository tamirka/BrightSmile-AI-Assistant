import React from 'react';
import {
    ToothIcon, SparkleIcon, BracesIcon, PlusIcon,
    PeopleIcon, TechIcon, HeartIcon, CalendarIcon,
    StarIcon, PhoneIcon, MailIcon, LocationIcon
} from './icons';

interface LandingPageProps {
    onEnterAssistant: () => void;
}

export default function LandingPage({ onEnterAssistant }: LandingPageProps) {
    return (
        <div className="bg-white text-gray-800 font-sans">
            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-50">
                <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="text-2xl font-bold text-cyan-600">
                        BrightSmile Dental Clinic
                    </div>
                    <div>
                        <a href="#contact" className="text-gray-600 hover:text-cyan-600 mx-4">Contact</a>
                        <button onClick={onEnterAssistant} className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-full hover:bg-cyan-700 transition duration-300">
                            Virtual Assistant
                        </button>
                    </div>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="relative text-center text-white">
                <img src="https://images.unsplash.com/photo-1629904850871-bb7b102f354b?q=80&w=1600&h=700&auto=format&fit=crop" alt="Modern dental clinic interior" className="w-full h-[70vh] object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center p-6">
                    <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">Experience Exceptional Dental Care</h1>
                    <p className="text-xl max-w-2xl mb-8 drop-shadow-md">Your smile is our priority. We combine state-of-the-art technology with a personal touch to provide you with the best dental care.</p>
                    <button onClick={onEnterAssistant} className="bg-cyan-500 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-cyan-600 transition duration-300 transform hover:scale-105">
                        Talk to our AI Assistant Now
                    </button>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-20 bg-gray-50">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-4">Our Services</h2>
                    <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">We offer a wide range of dental services to meet all your needs. From routine check-ups to advanced cosmetic procedures.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <ServiceCard icon={<ToothIcon className="h-12 w-12 text-cyan-500" />} title="General Dentistry" description="Routine check-ups, cleanings, fillings, and preventive care to maintain your oral health." />
                        <ServiceCard icon={<SparkleIcon className="h-12 w-12 text-cyan-500" />} title="Cosmetic Dentistry" description="Enhance your smile with veneers, bonding, and other aesthetic treatments." />
                        <ServiceCard icon={<BracesIcon className="h-12 w-12 text-cyan-500" />} title="Orthodontics" description="Straighten your teeth and correct your bite with modern braces and aligners." />
                        <ServiceCard icon={<ToothIcon className="h-12 w-12 text-cyan-500" />} title="Dental Implants" description="Permanent solutions for missing teeth that look and feel natural." />
                        <ServiceCard icon={<SparkleIcon className="h-12 w-12 text-cyan-500" />} title="Teeth Whitening" description="Brighten your smile with our safe and effective professional whitening treatments." />
                        <ServiceCard icon={<PlusIcon className="h-12 w-12 text-cyan-500" />} title="Emergency Care" description="We are here for you when you need us most. Prompt care for dental emergencies." />
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section id="why-us" className="py-20 bg-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-12">Why Choose BrightSmile?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                        <FeatureCard icon={<PeopleIcon className="h-10 w-10 text-cyan-600" />} title="Expert Team" description="Our team of experienced and caring professionals are dedicated to your health." />
                        <FeatureCard icon={<TechIcon className="h-10 w-10 text-cyan-600" />} title="Modern Technology" description="We use the latest technology for precise, comfortable, and efficient treatments." />
                        <FeatureCard icon={<HeartIcon className="h-10 w-10 text-cyan-600" />} title="Patient Comfort" description="A relaxing, stress-free environment where your comfort is our top priority." />
                        <FeatureCard icon={<CalendarIcon className="h-10 w-10 text-cyan-600" />} title="Flexible Scheduling" description="Convenient appointment times and easy booking to fit your busy lifestyle." />
                    </div>
                </div>
            </section>

            {/* Meet Our Team Section */}
            <section id="team" className="py-20 bg-gray-50">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-12">Meet Our Experts</h2>
                    <div className="flex flex-wrap justify-center gap-8">
                        <TeamMemberCard image="https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=300&h=300&auto=format&fit=crop" name="Dr. Emily Carter" title="Lead Dentist, DDS" bio="With over 15 years of experience, Dr. Carter is passionate about creating beautiful, healthy smiles through personalized care." />
                        <TeamMemberCard image="https://images.unsplash.com/photo-1537368910025-700350796527?q=80&w=300&h=300&auto=format&fit=crop" name="Dr. Ben Adams" title="Orthodontist, DMD" bio="Dr. Adams specializes in orthodontics, using the latest techniques to help patients achieve a perfect smile." />
                        <TeamMemberCard image="https://images.unsplash.com/photo-1612740683925-f4b7a1e3e1e2?q=80&w=300&h=300&auto=format&fit=crop" name="Dr. Olivia Chen" title="Cosmetic Specialist" bio="Dr. Chen is an artist in cosmetic dentistry, dedicated to helping you achieve the smile of your dreams." />
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section id="testimonials" className="py-20 bg-cyan-700 text-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-12">What Our Patients Say</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <TestimonialCard quote="The best dental experience I've ever had. The staff is incredibly friendly, professional, and made me feel at ease." author="Sarah L." />
                        <TestimonialCard quote="BrightSmile Clinic has completely transformed my smile! The technology is top-notch and the results are amazing." author="Michael P." />
                        <TestimonialCard quote="I used to be so anxious about dental visits, but Dr. Carter and her team are so gentle and caring. Highly recommended!" author="Jessica R." />
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-20 bg-gray-100">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl font-bold text-center mb-12">Get In Touch</h2>
                    <div className="flex flex-wrap -mx-4">
                        <div className="w-full lg:w-1/2 px-4 mb-8 lg:mb-0">
                            <div className="bg-white p-8 rounded-lg shadow-lg h-full">
                                <h3 className="text-2xl font-bold mb-6">Contact Information</h3>
                                <p className="flex items-center mb-4"><PhoneIcon className="h-6 w-6 mr-3 text-cyan-600" /> (123) 456-7890</p>
                                <p className="flex items-center mb-4"><MailIcon className="h-6 w-6 mr-3 text-cyan-600" /> contact@brightsmile.com</p>
                                <p className="flex items-center"><LocationIcon className="h-6 w-6 mr-3 text-cyan-600" /> 123 Dental Way, Smileville, ST 12345</p>
                                <h3 className="text-2xl font-bold mt-8 mb-4">Hours</h3>
                                <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
                                <p>Saturday: 9:00 AM - 1:00 PM</p>
                            </div>
                        </div>
                        <div className="w-full lg:w-1/2 px-4">
                            <img src="https://images.unsplash.com/photo-1588339399895-314ac4520286?q=80&w=600&h=450&auto=format&fit=crop" alt="Clinic location map" className="rounded-lg shadow-lg w-full h-full object-cover"/>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-800 text-white py-8">
                <div className="container mx-auto px-6 text-center">
                    <p>&copy; {new Date().getFullYear()} BrightSmile Dental Clinic. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
}

// Helper Components
const ServiceCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
        <div className="flex justify-center mb-4">{icon}</div>
        <h3 className="text-2xl font-bold mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
    </div>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="p-6">
        <div className="flex justify-center items-center h-20 w-20 mx-auto mb-4 bg-cyan-100 rounded-full">{icon}</div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
    </div>
);

const TeamMemberCard = ({ image, name, title, bio }: { image: string, name: string, title: string, bio: string }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-sm">
        <img src={image} alt={name} className="w-full h-64 object-cover" />
        <div className="p-6">
            <h3 className="text-2xl font-bold">{name}</h3>
            <p className="text-cyan-600 font-semibold mb-2">{title}</p>
            <p className="text-gray-600">{bio}</p>
        </div>
    </div>
);

const TestimonialCard = ({ quote, author }: { quote: string, author: string }) => (
    <div className="bg-cyan-800 p-8 rounded-lg shadow-lg">
        <div className="flex justify-center mb-4">
            <StarIcon className="h-6 w-6 text-yellow-400" />
            <StarIcon className="h-6 w-6 text-yellow-400" />
            <StarIcon className="h-6 w-6 text-yellow-400" />
            <StarIcon className="h-6 w-6 text-yellow-400" />
            <StarIcon className="h-6 w-6 text-yellow-400" />
        </div>
        <p className="text-lg italic mb-4">"{quote}"</p>
        <p className="font-bold">- {author}</p>
    </div>
);